import { indexedDBService } from './indexedDBService';

class DossierService {
  constructor() {
    this.worker = null;
    this.currentDossierId = null;
    this.activeRequests = new Map();
    this.requestTimeouts = new Map();
  }

  // Debounced request handler
  async debouncedRequest(key, requestFn, delay = 300) {
    // Cancel existing timeout for this key
    if (this.requestTimeouts.has(key)) {
      clearTimeout(this.requestTimeouts.get(key));
    }

    // Return existing promise if request is already active
    if (this.activeRequests.has(key)) {
      return this.activeRequests.get(key);
    }

    // Create new debounced request
    const promise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        try {
          const result = await requestFn();
          this.activeRequests.delete(key);
          this.requestTimeouts.delete(key);
          resolve(result);
        } catch (error) {
          this.activeRequests.delete(key);
          this.requestTimeouts.delete(key);
          reject(error);
        }
      }, delay);

      this.requestTimeouts.set(key, timeoutId);
    });

    this.activeRequests.set(key, promise);
    return promise;
  }

  async parseZipFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      // Create worker if not exists
      if (!this.worker) {
        this.worker = new Worker('/zipWorker.js');
      }
      
      const workerId = Date.now().toString();
      
      let allFiles = [];
      let treeStructure = null;
      
      const handleMessage = async (e) => {
        const { type, workerId: responseWorkerId, data, progress, error } = e.data;
        
        if (responseWorkerId !== workerId) return;
        
        if (type === 'PROGRESS') {
          onProgress?.(progress);
        } else if (type === 'TREE_READY') {
          // Tree structure is ready, show it immediately
          treeStructure = data;
          onProgress?.({ type: 'tree_ready', dossier: data });
        } else if (type === 'BATCH_PROCESSED') {
          // Accumulate files from batches
          allFiles.push(...data.files);
          onProgress?.({
            type: 'batch_progress',
            progress: data.progress,
            processed: data.processed,
            total: data.total,
            filesReady: allFiles.length
          });
        } else if (type === 'FILE_PROGRESS') {
          // Individual large file progress
          onProgress?.({
            type: 'file_progress',
            file: data.path,
            progress: data.progress
          });
        } else if (type === 'ZIP_PROCESSED') {
          try {
            // Save to IndexedDB with all accumulated files
            this.currentDossierId = await indexedDBService.saveDossier(
              treeStructure || data.dossier, 
              allFiles.length > 0 ? allFiles : data.files
            );
            this.worker.removeEventListener('message', handleMessage);
            resolve(treeStructure || data.dossier);
          } catch (dbError) {
            this.worker.removeEventListener('message', handleMessage);
            reject(new Error(`Storage error: ${dbError.message}`));
          }
        } else if (type === 'ERROR') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(error));
        }
      };
      
      this.worker.addEventListener('message', handleMessage);
      
      // Send file to worker
      this.worker.postMessage({
        type: 'PROCESS_ZIP',
        data: { file, workerId }
      });
    });
  }

  async getCachedDossier() {
    return await indexedDBService.getCachedDossier();
  }

  async clearDossier() {
    // Cancel all pending requests
    this.requestTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.requestTimeouts.clear();
    this.activeRequests.clear();
    
    await indexedDBService.clearDossier();
    this.currentDossierId = null;
  }

  async getFileBlob(path) {
    const requestKey = `file-${path}`;
    return this.debouncedRequest(requestKey, () => indexedDBService.getFileBlob(path), 100);
  }

  async findFileByPattern(pattern) {
    const requestKey = `pattern-${pattern}`;
    return this.debouncedRequest(requestKey, () => indexedDBService.findFileByPattern(pattern), 200);
  }


}

export const dossierService = new DossierService();