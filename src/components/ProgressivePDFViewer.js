import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { pdfPreloadService } from '../services/pdfPreloadService';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`;
pdfjs.disableWorker = false;

const ProgressivePDFViewer = ({ fileUrl, zoom, onZoomChange, fileName }) => {
  const [numPages, setNumPages] = useState(null);
  const [loadedPages, setLoadedPages] = useState(new Set());
  const [visiblePages, setVisiblePages] = useState(new Set([1]));
  const [pdfError, setPdfError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewportCache, setViewportCache] = useState(new Map());
  const [pdfDocument, setPdfDocument] = useState(null);
  
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const loadQueueRef = useRef(new Set());
  
  const CHUNK_SIZE = 5; // Load 5 pages at a time for better throughput
  const PRELOAD_DISTANCE = 3; // Preload pages within 3 pages of visible
  const VIEWPORT_CACHE_SIZE = 10; // Cache rendered viewports

  const onDocumentLoadSuccess = useCallback((pdf) => {
    setNumPages(pdf.numPages);
    setPdfDocument(pdf);
    setPdfError(null);
    setLoadingProgress(100);
    
    // Pre-cache document metadata for faster page access
    pdf.getMetadata().catch(() => {});
    
    // Start loading first chunk with priority
    loadPageChunk(1, Math.min(CHUNK_SIZE, pdf.numPages));
    
    // Trigger preloading of related PDFs
    if (fileName) {
      pdfPreloadService.preloadFolderPDFs(fileName);
    }
  }, [fileName]);

  const onDocumentLoadError = useCallback((error) => {
    console.error('PDF load error:', error);
    setPdfError('Failed to load PDF');
    setLoadingProgress(0);
  }, []);

  const loadPageChunk = useCallback((startPage, endPage) => {
    const pagesToLoad = [];
    for (let i = startPage; i <= endPage; i++) {
      if (!loadedPages.has(i) && !loadQueueRef.current.has(i)) {
        pagesToLoad.push(i);
        loadQueueRef.current.add(i);
      }
    }

    // Optimized batch loading with reduced delays
    pagesToLoad.forEach((pageNum, index) => {
      setTimeout(() => {
        setLoadedPages(prev => new Set(prev).add(pageNum));
        loadQueueRef.current.delete(pageNum);
        
        // Pre-cache viewport for common zoom levels
        if (pdfDocument) {
          cacheViewportForPage(pageNum, [0.75, 1, 1.25, 1.5]);
        }
      }, index * 50); // Reduced delay for faster loading
    });
  }, [loadedPages, pdfDocument]);
  
  const cacheViewportForPage = useCallback(async (pageNum, zoomLevels) => {
    if (!pdfDocument) return;
    
    try {
      const page = await pdfDocument.getPage(pageNum);
      zoomLevels.forEach(scale => {
        const viewport = page.getViewport({ scale });
        const cacheKey = `${pageNum}-${scale}`;
        setViewportCache(prev => new Map(prev).set(cacheKey, viewport));
      });
    } catch (error) {
      console.warn(`Failed to cache viewport for page ${pageNum}:`, error);
    }
  }, [pdfDocument]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || !numPages) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const newVisiblePages = new Set(visiblePages);
        
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.dataset.pageNumber);
          
          if (entry.isIntersecting) {
            newVisiblePages.add(pageNum);
            
            // Preload nearby pages
            const startPreload = Math.max(1, pageNum - PRELOAD_DISTANCE);
            const endPreload = Math.min(numPages, pageNum + PRELOAD_DISTANCE);
            loadPageChunk(startPreload, endPreload);
          } else {
            newVisiblePages.delete(pageNum);
          }
        });
        
        setVisiblePages(newVisiblePages);
      },
      {
        root: containerRef.current,
        rootMargin: '200px',
        threshold: 0.1
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [numPages, loadPageChunk, visiblePages]);

  // Observe page elements
  useEffect(() => {
    if (!observerRef.current) return;

    const pageElements = containerRef.current?.querySelectorAll('[data-page-number]');
    pageElements?.forEach(el => observerRef.current.observe(el));

    return () => {
      pageElements?.forEach(el => observerRef.current?.unobserve(el));
    };
  }, [numPages]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear viewport cache
      setViewportCache(new Map());
      
      // Cleanup intersection observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      
      // Clear any pending load operations
      loadQueueRef.current.clear();
    };
  }, []);

  const PagePlaceholder = ({ pageNumber }) => (
    <div
      data-page-number={pageNumber}
      style={{
        width: '100%',
        height: '800px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginBottom: '1rem',
        background: '#f8f9fa',
        color: '#666'
      }}
    >
      {loadQueueRef.current.has(pageNumber) ? (
        <div>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 0.5rem'
          }}></div>
          <p>Loading page {pageNumber}...</p>
        </div>
      ) : (
        <p>Page {pageNumber} - Click to load</p>
      )}
    </div>
  );

  const handlePlaceholderClick = (pageNumber) => {
    loadPageChunk(pageNumber, pageNumber);
  };

  if (pdfError) {
    return (
      <div style={{ padding: '2rem', color: '#dc3545', textAlign: 'center' }}>
        <p>❌ {pdfError}</p>
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3498db' }}>
          Open in browser instead
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Progress indicator */}
      {loadingProgress < 100 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            width: '100%',
            height: '4px',
            background: '#f0f0f0',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${loadingProgress}%`,
              height: '100%',
              background: '#3498db',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.5rem 0 0 0' }}>
            Loading PDF... {Math.round(loadingProgress)}%
          </p>
        </div>
      )}

      {/* PDF Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '0.75rem',
        background: '#fff',
        borderRadius: '4px',
        border: '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            {numPages ? `${numPages} pages` : 'Loading...'}
          </span>
          {numPages && (
            <span style={{ fontSize: '0.8rem', color: '#999' }}>
              • {loadedPages.size} loaded
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', background: '#fff' }}
          >
            −
          </button>
          <span style={{ fontSize: '0.8rem', color: '#666', minWidth: '50px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', background: '#fff' }}
          >
            +
          </button>
          <button
            onClick={() => onZoomChange(1)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', border: '1px solid #ddd', borderRadius: '3px', background: '#fff', marginLeft: '0.5rem' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* PDF Container */}
      <div
        ref={containerRef}
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          background: '#f8f9fa',
          textAlign: 'center',
          overflow: 'auto',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem'
        }}
      >
        <Document
          file={{
            url: pdfPreloadService.getPreloadedURL(fileName) || fileUrl,
            httpHeaders: {
              'Cache-Control': 'max-age=3600'
            },
            withCredentials: false
          }}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          onLoadProgress={({ loaded, total }) => {
            setLoadingProgress((loaded / total) * 100);
          }}
          options={{
            cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
          }}
          loading={
            <div style={{ padding: '2rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '3px solid #f3f3f3',
                borderTop: '3px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 0.5rem'
              }}></div>
              <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>Loading PDF...</p>
            </div>
          }
        >
          {numPages && Array.from(new Array(numPages), (el, index) => {
            const pageNumber = index + 1;
            const isLoaded = loadedPages.has(pageNumber);
            
            return isLoaded ? (
              <Page
                key={`page_${pageNumber}`}
                pageNumber={pageNumber}
                scale={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                style={{ marginBottom: '1rem' }}
                data-page-number={pageNumber}
                loading={<PagePlaceholder pageNumber={pageNumber} />}
              />
            ) : (
              <div
                key={`placeholder_${pageNumber}`}
                onClick={() => handlePlaceholderClick(pageNumber)}
                style={{ cursor: 'pointer' }}
              >
                <PagePlaceholder pageNumber={pageNumber} />
              </div>
            );
          })}
        </Document>
      </div>

      {/* Download link */}
      <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
        <a
          href={fileUrl}
          download={fileName}
          style={{ fontSize: '0.8rem', color: '#3498db', textDecoration: 'none' }}
        >
          📥 Download PDF
        </a>
      </div>
    </div>
  );
};

export default ProgressivePDFViewer;