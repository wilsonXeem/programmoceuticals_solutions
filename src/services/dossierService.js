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

  async parseFolder(files, onProgress) {
    try {
      if (!files || files.length === 0) {
        throw new Error('No files provided');
      }
      
      const root = { type: 'folder', name: 'root', children: [] };
      const fileData = [];
      
      onProgress?.(10);
      
      for (let i = 0; i < files.length; i++) {
        try {
          const file = files[i];
          if (!file) {
            console.log(`Skipping null file at index ${i}`);
            continue;
          }
          
          console.log(`Processing file ${i}:`, {
            name: file.name,
            size: file.size,
            type: file.type,
            webkitRelativePath: file.webkitRelativePath
          });
          
          const path = file.webkitRelativePath || file.name || `file_${i}`;
          const pathParts = path.split('/').filter(part => part.length > 0);
          
          if (pathParts.length === 0) continue;
          
          // Build tree structure
          let currentNode = root;
          for (let j = 0; j < pathParts.length - 1; j++) {
            const folderName = pathParts[j];
            if (!currentNode.children) currentNode.children = [];
            
            let folder = currentNode.children.find(child => child.name === folderName && child.type === 'folder');
            if (!folder) {
              folder = { type: 'folder', name: folderName, children: [] };
              currentNode.children.push(folder);
            }
            currentNode = folder;
          }
          
          // Add file to tree
          const fileName = pathParts[pathParts.length - 1];
          if (!currentNode.children) currentNode.children = [];
          
          const fileSize = (file && typeof file.size === 'number') ? file.size : 0;
          
          currentNode.children.push({
            type: 'file',
            name: fileName,
            path: path,
            size: fileSize
          });
          
          // Store file data
          fileData.push({
            path: path,
            file: file
          });
          
        } catch (fileError) {
          console.error(`Error processing file ${i}:`, fileError);
          continue;
        }
        
        const progress = 10 + (i / files.length) * 80;
        onProgress?.(progress);
      }
      
      const dossier = {
        name: files[0]?.webkitRelativePath?.split('/')[0] || 'Dossier',
        root: root,
        uploadDate: new Date().toISOString()
      };
      
      this.currentDossierId = await indexedDBService.saveDossier(dossier, fileData);
      onProgress?.(100);
      return dossier;
      
    } catch (error) {
      console.error('Folder processing error:', error);
      throw new Error(`Folder processing failed: ${error.message}`);
    }
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