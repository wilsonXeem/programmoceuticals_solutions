// IndexedDB service with enhanced caching and compression
class IndexedDBService {
  constructor() {
    this.dbName = 'DossierDB';
    this.version = 3;
    this.db = null;
    this.blobCache = new Map(); // LRU cache for frequently accessed blobs
    this.baseCacheSize = 50;
    this.maxCacheSize = this._calculateOptimalCacheSize();
    this.cacheAccessOrder = []; // Track access order for LRU
    this.compressionThreshold = 1024; // Compress files > 1KB
    this.preloadQueue = new Set(); // Files queued for preloading
    this.preloadInProgress = false;
    this.accessPatterns = new Map(); // Track file access patterns
    this.memoryMonitor = null;
    this._startMemoryMonitoring();
  }

  // Compression utilities
  async compressBlob(blob) {
    if (blob.size < this.compressionThreshold) return { blob, compressed: false };
    
    try {
      const stream = new CompressionStream('gzip');
      const compressedStream = blob.stream().pipeThrough(stream);
      const compressedBlob = await new Response(compressedStream).blob();
      return { blob: compressedBlob, compressed: true };
    } catch {
      return { blob, compressed: false };
    }
  }

  async decompressBlob(blob, wasCompressed) {
    if (!wasCompressed) return blob;
    
    try {
      const stream = new DecompressionStream('gzip');
      const decompressedStream = blob.stream().pipeThrough(stream);
      return await new Response(decompressedStream).blob();
    } catch {
      return blob;
    }
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        
        // Store for dossier metadata
        if (!db.objectStoreNames.contains('dossiers')) {
          const dossierStore = db.createObjectStore('dossiers', { keyPath: 'id' });
          dossierStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        
        // Enhanced file store with multiple indexes
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'path' });
          fileStore.createIndex('dossierId', 'dossierId', { unique: false });
          fileStore.createIndex('size', 'size', { unique: false });
          fileStore.createIndex('type', 'type', { unique: false });
          fileStore.createIndex('compressed', 'compressed', { unique: false });
        } else if (oldVersion < 3) {
          // Upgrade existing store
          const fileStore = event.target.transaction.objectStore('files');
          if (!fileStore.indexNames.contains('size')) {
            fileStore.createIndex('size', 'size', { unique: false });
          }
          if (!fileStore.indexNames.contains('type')) {
            fileStore.createIndex('type', 'type', { unique: false });
          }
          if (!fileStore.indexNames.contains('compressed')) {
            fileStore.createIndex('compressed', 'compressed', { unique: false });
          }
        }
        
        // Enhanced path index with normalized paths
        if (!db.objectStoreNames.contains('pathIndex')) {
          const indexStore = db.createObjectStore('pathIndex', { keyPath: 'dossierId' });
        }
        
        // Enhanced file metadata cache for quick access
        if (!db.objectStoreNames.contains('fileMetadata')) {
          const metaStore = db.createObjectStore('fileMetadata', { keyPath: 'path' });
          metaStore.createIndex('dossierId', 'dossierId', { unique: false });
          metaStore.createIndex('extension', 'extension', { unique: false });
          metaStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
          metaStore.createIndex('sizeRange', 'sizeRange', { unique: false });
        } else if (oldVersion < 3) {
          const metaStore = event.target.transaction.objectStore('fileMetadata');
          if (!metaStore.indexNames.contains('sizeRange')) {
            metaStore.createIndex('sizeRange', 'sizeRange', { unique: false });
          }
        }
      };
    });
  }

  async saveDossier(dossierData, files) {
    if (!this.db) await this.init();
    
    const dossierId = Date.now().toString();
    const pathIndex = {};
    
    try {
      // Save dossier metadata
      const dossierTx = this.db.transaction(['dossiers'], 'readwrite');
      await this.promisifyRequest(dossierTx.objectStore('dossiers').put({
        id: dossierId,
        name: dossierData.name,
        root: dossierData.root,
        createdAt: new Date().toISOString()
      }));
      
      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        // Pre-compress files outside transaction
        const compressedBatch = await Promise.all(
          batch.map(async (file) => {
            const { blob: compressedBlob, compressed } = await this.compressBlob(file.blob);
            pathIndex[file.path.toLowerCase()] = file.path;
            return {
              path: file.path,
              dossierId,
              blob: compressedBlob,
              originalSize: file.size,
              compressedSize: compressedBlob.size,
              type: file.type,
              compressed
            };
          })
        );
        
        // Save batch in single transaction
        const fileTx = this.db.transaction(['files'], 'readwrite');
        const fileStore = fileTx.objectStore('files');
        
        await Promise.all(
          compressedBatch.map(fileData => this.promisifyRequest(fileStore.put(fileData)))
        );
      }
      
      // Save path index
      const indexTx = this.db.transaction(['pathIndex'], 'readwrite');
      await this.promisifyRequest(indexTx.objectStore('pathIndex').put({
        dossierId,
        paths: pathIndex
      }));
      
      return dossierId;
    } catch (error) {
      console.error('Save dossier error:', error);
      throw error;
    }
  }

  async getCachedDossier() {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['dossiers'], 'readonly');
    const store = transaction.objectStore('dossiers');
    const request = store.getAll();
    
    const dossiers = await this.promisifyRequest(request);
    
    // Return most recent dossier
    if (dossiers.length > 0) {
      const latest = dossiers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return { id: latest.id, name: latest.name, root: latest.root };
    }
    
    return null;
  }

  async getFileBlob(path) {
    // Track access pattern
    this._trackAccess(path);
    
    // Check LRU cache first
    if (this.blobCache.has(path)) {
      this._updateCacheAccess(path);
      this._triggerPredictivePreload(path);
      return this.blobCache.get(path);
    }
    
    // Priority handling for PDF files
    const isPDF = path.toLowerCase().endsWith('.pdf');
    if (isPDF) {
      return this._getOptimizedPDFBlob(path);
    }
    
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(path);
    
    const result = await this.promisifyRequest(request);
    if (!result) return null;
    
    // Decompress if needed
    const decompressedBlob = await this.decompressBlob(result.blob, result.compressed);
    
    const fileData = {
      blob: decompressedBlob,
      type: result.type,
      size: result.originalSize || result.size,
      compressedSize: result.compressedSize
    };
    
    // Cache the decompressed file data
    if (fileData.blob) {
      this._addToCache(path, fileData);
    }
    
    // Trigger predictive preloading
    this._triggerPredictivePreload(path);
    
    return fileData;
  }
  
  _trackAccess(path) {
    const now = Date.now();
    if (!this.accessPatterns.has(path)) {
      this.accessPatterns.set(path, { count: 0, lastAccess: now, avgInterval: 0 });
    }
    
    const pattern = this.accessPatterns.get(path);
    if (pattern.lastAccess) {
      const interval = now - pattern.lastAccess;
      pattern.avgInterval = (pattern.avgInterval + interval) / 2;
    }
    pattern.count++;
    pattern.lastAccess = now;
  }
  
  _triggerPredictivePreload(currentPath) {
    if (this.preloadInProgress) return;
    
    // Predict next files based on folder structure and access patterns
    const pathParts = currentPath.split('/');
    const folder = pathParts.slice(0, -1).join('/');
    
    // Queue sibling files for preloading
    this._queueSiblingFiles(folder, currentPath);
    
    // Start preloading if queue has items
    if (this.preloadQueue.size > 0) {
      this._startPreloading();
    }
  }
  
  async _queueSiblingFiles(folder, currentPath) {
    // Get files in same folder for preloading
    const dossier = await this.getCachedDossier();
    if (!dossier) return;
    
    const transaction = this.db.transaction(['pathIndex'], 'readonly');
    const store = transaction.objectStore('pathIndex');
    const request = store.get(dossier.id);
    
    const indexData = await this.promisifyRequest(request);
    if (!indexData) return;
    
    // Find sibling files (same folder, similar names)
    Object.values(indexData.paths).forEach(path => {
      if (path !== currentPath && 
          path.startsWith(folder) && 
          !this.blobCache.has(path) &&
          this.preloadQueue.size < 5) {
        this.preloadQueue.add(path);
      }
    });
  }
  
  async _startPreloading() {
    if (this.preloadInProgress || this.preloadQueue.size === 0) return;
    
    this.preloadInProgress = true;
    
    try {
      const pathsToPreload = Array.from(this.preloadQueue).slice(0, 3);
      this.preloadQueue.clear();
      
      // Preload files in background
      const preloadPromises = pathsToPreload.map(async (path) => {
        try {
          if (!this.blobCache.has(path)) {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(path);
            const result = await this.promisifyRequest(request);
            
            if (result) {
              const decompressedBlob = await this.decompressBlob(result.blob, result.compressed);
              const fileData = {
                blob: decompressedBlob,
                type: result.type,
                size: result.originalSize || result.size
              };
              this._addToCache(path, fileData);
            }
          }
        } catch (error) {
          console.warn('Preload failed for:', path, error);
        }
      });
      
      await Promise.all(preloadPromises);
    } finally {
      this.preloadInProgress = false;
    }
  }
  
  _addToCache(path, fileData, isPriority = false) {
    // For priority items (PDFs), ensure space by removing non-priority items first
    if (isPriority && this.blobCache.size >= this.maxCacheSize) {
      // Find and remove non-PDF items first
      for (const [cachedPath, cachedData] of this.blobCache.entries()) {
        if (!cachedData.isPDF) {
          this.blobCache.delete(cachedPath);
          const index = this.cacheAccessOrder.indexOf(cachedPath);
          if (index > -1) this.cacheAccessOrder.splice(index, 1);
          break;
        }
      }
    }
    
    // Remove oldest if cache is still full
    if (this.blobCache.size >= this.maxCacheSize) {
      const oldest = this.cacheAccessOrder.shift();
      this.blobCache.delete(oldest);
    }
    
    this.blobCache.set(path, fileData);
    
    // Priority items go to end (most recent)
    if (isPriority) {
      this.cacheAccessOrder.push(path);
    } else {
      // Regular items go before priority items
      const lastPriorityIndex = this.cacheAccessOrder.findLastIndex(p => 
        this.blobCache.get(p)?.isPDF
      );
      if (lastPriorityIndex > -1) {
        this.cacheAccessOrder.splice(lastPriorityIndex, 0, path);
      } else {
        this.cacheAccessOrder.push(path);
      }
    }
  }
  
  _updateCacheAccess(path) {
    const index = this.cacheAccessOrder.indexOf(path);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
      this.cacheAccessOrder.push(path);
    }
  }

  async findFileByPattern(pattern) {
    if (!this.db) await this.init();
    
    // Get current dossier's path index
    const dossier = await this.getCachedDossier();
    if (!dossier) return null;
    
    const transaction = this.db.transaction(['pathIndex'], 'readonly');
    const store = transaction.objectStore('pathIndex');
    const request = store.get(dossier.id);
    
    const indexData = await this.promisifyRequest(request);
    if (!indexData) return null;
    
    const normalizedPattern = pattern.toLowerCase();
    
    // Fast lookup in pre-computed index with priority scoring
    const matches = [];
    for (const [normalizedPath, originalPath] of Object.entries(indexData.paths)) {
      if (normalizedPath.includes(normalizedPattern)) {
        const score = this._calculateMatchScore(normalizedPath, normalizedPattern);
        matches.push({ path: originalPath, score });
      }
    }
    
    // Return best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      return matches[0].path;
    }
    
    return null;
  }
  
  _calculateMatchScore(path, pattern) {
    let score = 0;
    
    // Exact match gets highest score
    if (path === pattern) score += 100;
    
    // Filename match gets high score
    const filename = path.split('/').pop();
    if (filename.includes(pattern)) score += 50;
    
    // Extension match
    if (path.endsWith(pattern)) score += 30;
    
    // Path contains pattern
    if (path.includes(pattern)) score += 10;
    
    // Shorter paths get slight preference
    score -= path.split('/').length;
    
    return score;
  }
  
  // New optimized batch operations
  async getMultipleFiles(paths) {
    if (!this.db) await this.init();
    
    const results = new Map();
    const uncachedPaths = [];
    
    // Check cache first
    paths.forEach(path => {
      if (this.blobCache.has(path)) {
        results.set(path, this.blobCache.get(path));
        this._updateCacheAccess(path);
      } else {
        uncachedPaths.push(path);
      }
    });
    
    // Batch fetch uncached files
    if (uncachedPaths.length > 0) {
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const promises = uncachedPaths.map(async (path) => {
        try {
          const result = await this.promisifyRequest(store.get(path));
          if (result) {
            const decompressedBlob = await this.decompressBlob(result.blob, result.compressed);
            const fileData = {
              blob: decompressedBlob,
              type: result.type,
              size: result.originalSize || result.size
            };
            results.set(path, fileData);
            this._addToCache(path, fileData);
          }
        } catch (error) {
          console.warn('Failed to fetch file:', path, error);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }
  
  // Optimized PDF blob retrieval with streaming
  async _getOptimizedPDFBlob(path) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const request = store.get(path);
    
    const result = await this.promisifyRequest(request);
    if (!result) return null;
    
    // For PDFs, use streaming decompression for better performance
    let decompressedBlob;
    if (result.compressed && result.blob.size > 1024 * 1024) { // 1MB threshold
      decompressedBlob = await this._streamDecompressBlob(result.blob);
    } else {
      decompressedBlob = await this.decompressBlob(result.blob, result.compressed);
    }
    
    const fileData = {
      blob: decompressedBlob,
      type: result.type,
      size: result.originalSize || result.size,
      compressedSize: result.compressedSize,
      isPDF: true
    };
    
    // Higher priority caching for PDFs
    this._addToCache(path, fileData, true);
    this._triggerPredictivePreload(path);
    
    return fileData;
  }
  
  async _streamDecompressBlob(blob) {
    try {
      const stream = new DecompressionStream('gzip');
      const reader = blob.stream().pipeThrough(stream).getReader();
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      return new Blob(chunks);
    } catch (error) {
      console.warn('Stream decompression failed, falling back:', error);
      return this.decompressBlob(blob, true);
    }
  }
  
  // Get files by type efficiently
  async getFilesByType(type) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('type');
    
    const request = index.getAll(type);
    const results = await this.promisifyRequest(request);
    
    return results.map(result => ({
      path: result.path,
      size: result.originalSize || result.size,
      type: result.type
    }));
  }

  async clearDossier() {
    if (!this.db) await this.init();
    
    try {
      const tx = this.db.transaction(['dossiers', 'files', 'pathIndex'], 'readwrite');
      await Promise.all([
        this.promisifyRequest(tx.objectStore('dossiers').clear()),
        this.promisifyRequest(tx.objectStore('files').clear()),
        this.promisifyRequest(tx.objectStore('pathIndex').clear())
      ]);
    } catch (error) {
      console.warn('Clear error:', error);
    }
    
    // Clear cache and patterns
    this.blobCache.clear();
    this.cacheAccessOrder.length = 0;
    this.accessPatterns.clear();
    this.preloadQueue.clear();
    this._stopMemoryMonitoring();
  }

  _calculateOptimalCacheSize() {
    try {
      const memory = navigator.deviceMemory || 4;
      const availableMemory = memory * 1024 * 1024 * 1024;
      const targetCacheMemory = availableMemory * 0.02;
      const avgFileSize = 512 * 1024;
      const calculatedSize = Math.floor(targetCacheMemory / avgFileSize);
      return Math.max(this.baseCacheSize, Math.min(calculatedSize, 500));
    } catch {
      return this.baseCacheSize;
    }
  }
  
  _startMemoryMonitoring() {
    if (!('memory' in performance)) return;
    
    this.memoryMonitor = setInterval(() => {
      try {
        const memInfo = performance.memory;
        const memoryPressure = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        
        if (memoryPressure > 0.8) {
          this.maxCacheSize = Math.max(20, Math.floor(this.maxCacheSize * 0.7));
          this._evictExcessItems();
        } else if (memoryPressure < 0.5 && this.maxCacheSize < this._calculateOptimalCacheSize()) {
          this.maxCacheSize = Math.min(this._calculateOptimalCacheSize(), this.maxCacheSize + 10);
        }
      } catch (error) {
        console.warn('Memory monitoring failed:', error);
      }
    }, 10000);
  }
  
  _stopMemoryMonitoring() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }
  
  _evictExcessItems() {
    while (this.blobCache.size > this.maxCacheSize && this.cacheAccessOrder.length > 0) {
      const oldest = this.cacheAccessOrder.shift();
      this.blobCache.delete(oldest);
    }
  }

  promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const indexedDBService = new IndexedDBService();