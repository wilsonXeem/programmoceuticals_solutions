// Web Worker for ZIP processing
importScripts('https://unpkg.com/jszip@3.10.1/dist/jszip.min.js');

self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  if (type === 'PROCESS_ZIP') {
    try {
      const { file, workerId } = data;
      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      
      const allPaths = Object.keys(content.files).filter(path => path.trim() !== '');
      const rootName = getRootFolderName(allPaths);
      
      const root = {
        name: rootName,
        path: '',
        type: 'folder',
        children: []
      };

      const fileData = [];
      let processedCount = 0;
      const batchSize = 10; // Increased batch size for better performance
      
      // Separate folders and files for better processing
      const folders = allPaths.filter(path => content.files[path].dir);
      const files = allPaths.filter(path => !content.files[path].dir);
      
      // Build tree structure first (fast operation)
      for (const relativePath of allPaths) {
        const file = content.files[relativePath];
        const parts = relativePath.split('/').filter(part => part.trim() !== '');
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isLastPart = i === parts.length - 1;
          const isFile = !file.dir && isLastPart;

          const nodePath = parts.slice(0, i + 1).join('/');
          let existing = currentNode.children?.find((c) => c.path === nodePath);
          if (!existing) {
            const newNode = {
              name: part,
              path: nodePath,
              type: isFile ? 'file' : 'folder',
              children: isFile ? undefined : []
            };
            currentNode.children?.push(newNode);
            existing = newNode;
          }
          currentNode = existing;
        }
      }
      
      // Send tree structure early for immediate UI update
      self.postMessage({
        type: 'TREE_READY',
        workerId,
        data: { name: rootName, root }
      });
      
      // Enhanced streaming with memory management
      const LARGE_FILE_THRESHOLD = 256 * 1024; // 256KB
      const HUGE_FILE_THRESHOLD = 2 * 1024 * 1024; // 2MB
      
      // Separate files by size and type for optimal processing
      const smallFiles = [];
      const largeFiles = [];
      const hugeFiles = [];
      const pdfFiles = [];
      
      files.forEach(path => {
        const size = content.files[path]._data?.uncompressedSize || 0;
        const isPDF = path.toLowerCase().endsWith('.pdf');
        
        if (isPDF) {
          pdfFiles.push({ path, size });
        } else if (size > HUGE_FILE_THRESHOLD) {
          hugeFiles.push(path);
        } else if (size > LARGE_FILE_THRESHOLD) {
          largeFiles.push(path);
        } else {
          smallFiles.push(path);
        }
      });
      
      // Sort PDFs by size for optimal processing order
      pdfFiles.sort((a, b) => a.size - b.size);
      const sortedPDFs = pdfFiles.map(f => f.path);
      
      // Process PDFs first with optimized batching
      await processFileBatch(sortedPDFs, 5, 'pdf');
      
      // Process small files in larger batches
      await processFileBatch(smallFiles, 50, 'small');
      
      // Process large files in smaller batches
      await processFileBatch(largeFiles, 10, 'large');
      
      // Process huge files individually with streaming
      await processFileBatch(hugeFiles, 1, 'huge');
      
      async function processFileBatch(filePaths, batchSize, type) {
        for (let i = 0; i < filePaths.length; i += batchSize) {
          const batch = filePaths.slice(i, i + batchSize);
          const batchData = [];
          
          for (const relativePath of batch) {
            const file = content.files[relativePath];
            
            try {
              const uncompressedSize = file._data?.uncompressedSize || 0;
              let blob;
              
              if (type === 'pdf') {
                // Optimized PDF processing with progress tracking
                blob = await file.async('blob', (metadata) => {
                  if (metadata.percent && metadata.percent % 5 === 0) {
                    self.postMessage({
                      type: 'FILE_PROGRESS',
                      workerId,
                      data: { 
                        path: relativePath, 
                        progress: metadata.percent,
                        size: uncompressedSize,
                        type: 'pdf'
                      }
                    });
                  }
                });
              } else if (type === 'huge') {
                // Enhanced streaming for huge files with memory cleanup
                blob = await file.async('blob', (metadata) => {
                  if (metadata.percent && metadata.percent % 10 === 0) {
                    self.postMessage({
                      type: 'FILE_PROGRESS',
                      workerId,
                      data: { 
                        path: relativePath, 
                        progress: metadata.percent,
                        size: uncompressedSize,
                        type: 'streaming'
                      }
                    });
                  }
                });
                
                // Memory cleanup after processing large files
                if (self.gc) self.gc();
              } else {
                blob = await file.async('blob');
              }
              
              // Aggressive memory cleanup
              delete content.files[relativePath];
              
              // Force garbage collection hint
              if (type === 'huge' && self.gc) {
                self.gc();
              }
              
              const mimeType = getMimeType(relativePath);
              const typedBlob = new Blob([blob], { type: mimeType });
              
              batchData.push({
                path: relativePath,
                blob: typedBlob,
                size: typedBlob.size,
                type: mimeType
              });
              
              processedCount++;
            } catch (error) {
              console.warn(`Failed to process file ${relativePath}:`, error);
              processedCount++;
            }
          }
          
          fileData.push(...batchData);
          
          self.postMessage({
            type: 'BATCH_PROCESSED',
            workerId,
            data: {
              files: batchData,
              progress: (processedCount / files.length) * 100,
              processed: processedCount,
              total: files.length,
              batchType: type
            }
          });
          
          // Adaptive yielding and memory cleanup
          const yieldTime = type === 'huge' ? 15 : type === 'large' ? 8 : 3;
          await new Promise(resolve => setTimeout(resolve, yieldTime));
          
          // Memory cleanup after each batch
          if (type !== 'small' && self.gc) {
            self.gc();
          }
        }
      }
      
      // Final completion message
      self.postMessage({
        type: 'ZIP_PROCESSED',
        workerId,
        data: {
          dossier: { name: rootName, root },
          files: fileData,
          totalFiles: files.length,
          totalSize: fileData.reduce((sum, f) => sum + f.size, 0)
        }
      });
      
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        workerId: data.workerId,
        error: error.message
      });
    }
  }
};

function getRootFolderName(paths) {
  if (paths.length === 0) return 'Empty Dossier';
  
  const firstPath = paths[0];
  const rootFolder = firstPath.split('/')[0];
  
  const hasCommonRoot = paths.every(path => path.startsWith(rootFolder + '/') || path === rootFolder);
  
  return hasCommonRoot ? rootFolder : 'Dossier Files';
}

function getMimeType(path) {
  const ext = path.toLowerCase().split('.').pop();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'xml': 'application/xml',
    'json': 'application/json'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}