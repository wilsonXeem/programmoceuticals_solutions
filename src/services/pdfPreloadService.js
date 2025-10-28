// PDF Preloading Service for optimized PDF loading
class PDFPreloadService {
  constructor() {
    this.preloadQueue = new Map(); // path -> priority
    this.loadingPromises = new Map();
    this.isProcessing = false;
    this.maxConcurrent = 3;
    this.currentLoading = 0;
  }

  // Add PDF to preload queue with priority
  queuePDF(path, priority = 1) {
    if (!path.toLowerCase().endsWith('.pdf')) return;
    
    // Higher priority = loaded first
    this.preloadQueue.set(path, Math.max(this.preloadQueue.get(path) || 0, priority));
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Queue multiple PDFs (e.g., from same folder)
  queueMultiplePDFs(paths, basePriority = 1) {
    paths.forEach((path, index) => {
      // Slightly lower priority for subsequent files
      const priority = basePriority - (index * 0.1);
      this.queuePDF(path, priority);
    });
  }

  // Process the preload queue
  async processQueue() {
    if (this.isProcessing || this.preloadQueue.size === 0) return;
    
    this.isProcessing = true;
    
    try {
      while (this.preloadQueue.size > 0 && this.currentLoading < this.maxConcurrent) {
        // Get highest priority PDF
        const [nextPath] = [...this.preloadQueue.entries()]
          .sort(([,a], [,b]) => b - a)[0] || [];
        
        if (!nextPath) break;
        
        this.preloadQueue.delete(nextPath);
        
        // Skip if already loading or loaded
        if (this.loadingPromises.has(nextPath)) continue;
        
        this.currentLoading++;
        const loadPromise = this.preloadPDF(nextPath)
          .finally(() => {
            this.currentLoading--;
            this.loadingPromises.delete(nextPath);
          });
        
        this.loadingPromises.set(nextPath, loadPromise);
        
        // Don't await - allow concurrent loading
        loadPromise.catch(error => {
          console.warn(`PDF preload failed for ${nextPath}:`, error);
        });
      }
    } finally {
      this.isProcessing = false;
      
      // Continue processing if more items were added
      if (this.preloadQueue.size > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  // Preload a single PDF
  async preloadPDF(path) {
    try {
      const { dossierService } = await import('./dossierService');
      const fileData = await dossierService.getFileBlob(path);
      
      if (fileData?.blob) {
        // Create object URL for faster subsequent access
        const objectUrl = URL.createObjectURL(fileData.blob);
        
        // Store in a simple cache for immediate access
        this.urlCache = this.urlCache || new Map();
        this.urlCache.set(path, objectUrl);
        
        // Clean up old URLs to prevent memory leaks
        if (this.urlCache.size > 20) {
          const [oldPath, oldUrl] = this.urlCache.entries().next().value;
          URL.revokeObjectURL(oldUrl);
          this.urlCache.delete(oldPath);
        }
        
        return objectUrl;
      }
    } catch (error) {
      console.warn(`Failed to preload PDF ${path}:`, error);
      throw error;
    }
  }

  // Get preloaded PDF URL if available
  getPreloadedURL(path) {
    return this.urlCache?.get(path);
  }

  // Clear all preloaded data
  clearCache() {
    if (this.urlCache) {
      for (const url of this.urlCache.values()) {
        URL.revokeObjectURL(url);
      }
      this.urlCache.clear();
    }
    
    this.preloadQueue.clear();
    this.loadingPromises.clear();
    this.currentLoading = 0;
    this.isProcessing = false;
  }

  // Smart preloading based on folder structure
  async preloadFolderPDFs(currentPath) {
    try {
      const { dossierService } = await import('./dossierService');
      const dossier = await dossierService.getCachedDossier();
      
      if (!dossier) return;
      
      // Find PDFs in the same folder
      const folder = currentPath.split('/').slice(0, -1).join('/');
      const folderPDFs = this.findPDFsInFolder(dossier.root, folder);
      
      // Queue with decreasing priority
      this.queueMultiplePDFs(folderPDFs, 0.8);
      
    } catch (error) {
      console.warn('Failed to preload folder PDFs:', error);
    }
  }

  // Find PDFs in a specific folder
  findPDFsInFolder(node, targetFolder, currentPath = '') {
    const pdfs = [];
    
    if (node.type === 'file' && node.path.toLowerCase().endsWith('.pdf')) {
      const filePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      const fileFolder = filePath.split('/').slice(0, -1).join('/');
      
      if (fileFolder === targetFolder) {
        pdfs.push(node.path);
      }
    } else if (node.children) {
      for (const child of node.children) {
        const childPath = currentPath ? `${currentPath}/${child.name}` : child.name;
        pdfs.push(...this.findPDFsInFolder(child, targetFolder, childPath));
      }
    }
    
    return pdfs;
  }
}

export const pdfPreloadService = new PDFPreloadService();