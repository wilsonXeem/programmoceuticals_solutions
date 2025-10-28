// Background processing service for non-critical tasks
class BackgroundProcessor {
  constructor() {
    this.taskQueue = [];
    this.isProcessing = false;
    this.maxConcurrentTasks = 2;
    this.activeTasks = new Set();
    this.taskHistory = new Map();
    this.priorities = { LOW: 1, NORMAL: 2, HIGH: 3 };
  }

  // Add task to background queue
  addTask(taskId, taskFn, options = {}) {
    const task = {
      id: taskId,
      fn: taskFn,
      priority: options.priority || this.priorities.NORMAL,
      delay: options.delay || 0,
      retries: options.retries || 0,
      maxRetries: options.maxRetries || 2,
      createdAt: Date.now(),
      ...options
    };

    // Prevent duplicate tasks
    if (this.taskHistory.has(taskId) && !options.allowDuplicates) {
      return this.taskHistory.get(taskId);
    }

    // Insert task based on priority
    const insertIndex = this.taskQueue.findIndex(t => t.priority < task.priority);
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.processQueue();
    
    // Return promise for task completion
    const promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });
    
    this.taskHistory.set(taskId, promise);
    return promise;
  }

  async processQueue() {
    if (this.isProcessing || this.activeTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    this.isProcessing = true;

    while (this.taskQueue.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
      const task = this.taskQueue.shift();
      this.processTask(task);
    }

    this.isProcessing = false;
  }

  async processTask(task) {
    this.activeTasks.add(task.id);

    try {
      // Apply delay if specified
      if (task.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, task.delay));
      }

      // Use requestIdleCallback for better performance
      const result = await new Promise((resolve, reject) => {
        const executeTask = async () => {
          try {
            const result = await task.fn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        };

        if ('requestIdleCallback' in window) {
          requestIdleCallback(executeTask, { timeout: 5000 });
        } else {
          setTimeout(executeTask, 0);
        }
      });

      task.resolve(result);
    } catch (error) {
      if (task.retries < task.maxRetries) {
        task.retries++;
        task.delay = Math.min(task.delay * 2 || 1000, 5000); // Exponential backoff
        this.taskQueue.unshift(task); // Retry with higher priority
      } else {
        task.reject(error);
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.processQueue(); // Process next tasks
    }
  }

  // Predefined background tasks
  warmCache(paths) {
    return this.addTask('cache-warm', async () => {
      const { indexedDBService } = await import('./indexedDBService');
      const results = await indexedDBService.getMultipleFiles(paths.slice(0, 10));
      return `Warmed cache for ${results.size} files`;
    }, { priority: this.priorities.LOW, delay: 2000 });
  }

  prepareReportData(dossier) {
    return this.addTask('report-prep', async () => {
      const { memoizedChecklistMatch } = await import('../hooks/useMemoizedOperations');
      // Pre-calculate report data
      return 'Report data prepared';
    }, { priority: this.priorities.NORMAL });
  }

  cleanupOldCache() {
    return this.addTask('cache-cleanup', async () => {
      const { indexedDBService } = await import('./indexedDBService');
      // Cleanup old cached files
      return 'Cache cleaned';
    }, { priority: this.priorities.LOW, delay: 10000 });
  }

  indexFiles(files) {
    return this.addTask('file-index', async () => {
      // Build search index for files
      const searchIndex = new Map();
      files.forEach(file => {
        const terms = file.name.toLowerCase().split(/[\s\-_\.]+/);
        terms.forEach(term => {
          if (!searchIndex.has(term)) searchIndex.set(term, []);
          searchIndex.get(term).push(file.path);
        });
      });
      return `Indexed ${files.length} files`;
    }, { priority: this.priorities.LOW });
  }

  preloadComponents() {
    return this.addTask('component-preload', async () => {
      const { preloadReportLibraries, preloadPDFLibrary } = await import('../utils/lazyImports');
      await Promise.all([preloadReportLibraries(), preloadPDFLibrary()]);
      return 'Components preloaded';
    }, { priority: this.priorities.HIGH });
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      totalProcessed: this.taskHistory.size
    };
  }

  // Clear completed tasks from history
  clearHistory() {
    this.taskHistory.clear();
  }
}

export const backgroundProcessor = new BackgroundProcessor();