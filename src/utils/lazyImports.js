// Lazy imports for heavy libraries with caching and preloading
const libraryCache = new Map();

// Generic library loader with caching
const loadLibrary = async (name, importFn) => {
  if (libraryCache.has(name)) {
    return libraryCache.get(name);
  }
  
  try {
    const library = await importFn();
    libraryCache.set(name, library);
    return library;
  } catch (error) {
    console.error(`Failed to load ${name}:`, error);
    throw new Error(`Failed to load ${name} library`);
  }
};

// PDF libraries (loaded on demand)
export const loadPDFLibrary = () => loadLibrary('react-pdf', () => import('react-pdf'));
export const loadJSPDFLibrary = () => loadLibrary('jspdf', () => import('jspdf'));
export const loadAutoTableLibrary = () => loadLibrary('jspdf-autotable', () => import('jspdf-autotable'));
export const loadFileSaverLibrary = () => loadLibrary('file-saver', () => import('file-saver'));

// Enhanced preloading with user intent detection
let preloadState = {
  reportLibsLoaded: false,
  pdfLibLoaded: false,
  userOnScreening: false
};

// Background task integration
let backgroundProcessor = null;
const getBackgroundProcessor = async () => {
  if (!backgroundProcessor) {
    const module = await import('../services/backgroundProcessor');
    backgroundProcessor = module.backgroundProcessor;
  }
  return backgroundProcessor;
};

export const preloadReportLibraries = async () => {
  if (preloadState.reportLibsLoaded) return;
  
  preloadState.reportLibsLoaded = true;
  
  // Use background processor for better task management
  try {
    const processor = await getBackgroundProcessor();
    return processor.addTask('report-libs', async () => {
      await Promise.all([
        loadJSPDFLibrary(),
        loadAutoTableLibrary(),
        loadFileSaverLibrary()
      ]);
      return 'Report libraries loaded';
    }, { priority: 2, delay: 100 });
  } catch {
    // Fallback to original method
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        Promise.all([
          loadJSPDFLibrary(),
          loadAutoTableLibrary(),
          loadFileSaverLibrary()
        ]);
      });
    } else {
      setTimeout(() => {
        Promise.all([
          loadJSPDFLibrary(),
          loadAutoTableLibrary(),
          loadFileSaverLibrary()
        ]);
      }, 100);
    }
  }
};

export const preloadPDFLibrary = async () => {
  if (preloadState.pdfLibLoaded) return;
  
  preloadState.pdfLibLoaded = true;
  
  // Use background processor for better task management
  try {
    const processor = await getBackgroundProcessor();
    return processor.addTask('pdf-lib', async () => {
      await loadPDFLibrary();
      return 'PDF library loaded';
    }, { priority: 2, delay: 50 });
  } catch {
    // Fallback to original method
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadPDFLibrary());
    } else {
      setTimeout(() => loadPDFLibrary(), 100);
    }
  }
};

// Smart preloading based on user behavior
export const initSmartPreloading = () => {
  // Preload when user hovers over navigation
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('[href*="review"]')) {
      preloadReportLibraries();
    }
    if (e.target.closest('[href*="screening"]') && !preloadState.userOnScreening) {
      preloadState.userOnScreening = true;
      preloadPDFLibrary();
    }
  });
  
  // Preload on scroll (user engagement)
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (window.location.pathname === '/screening') {
        preloadReportLibraries();
      }
    }, 1000);
  });
};

// Clear cache if needed
export const clearLibraryCache = () => {
  libraryCache.clear();
  preloadState = {
    reportLibsLoaded: false,
    pdfLibLoaded: false,
    userOnScreening: false
  };
};