import React, { useState, useEffect, useRef, useCallback } from "react";
import { useDossier } from "../hooks/useDossier";
import { useDebounce, useRequestDeduplication } from "../hooks/useDebounce";
import DossierTree from "./DossierTree";
import { Document, Page, pdfjs } from 'react-pdf';
import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const TabContent = ({ activeFile, isLoading, fileUrl, isPdfFile, isDocxFile, pdfZoom, setPdfZoom, getFileIcon, getFileType }) => {
  const [numPages, setNumPages] = useState(null);
  const [pdfError, setPdfError] = useState(null);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error);
    setPdfError('Failed to load PDF');
  };

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{
        marginBottom: "1.5rem",
        padding: "1.25rem",
        background: "linear-gradient(135deg, #f8f9fa, #e9ecef)",
        borderRadius: "12px",
        border: "2px solid #dee2e6",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#2c3e50" }}>
          {getFileIcon(activeFile.name)} {activeFile.name}
        </h3>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
          {activeFile.path.split('/').find(part => part.toLowerCase().startsWith('module')) ? 
            activeFile.path.substring(activeFile.path.indexOf(activeFile.path.split('/').find(part => part.toLowerCase().startsWith('module')))) : 
            activeFile.path
          } • {getFileType(activeFile.name)}
        </p>
      </div>

      {isLoading ? (
        <div style={{
          padding: "2rem",
          textAlign: "center",
          background: "#f8f9fa",
          borderRadius: "8px"
        }}>
          <div style={{
            width: "24px",
            height: "24px",
            border: "3px solid #f3f3f3",
            borderTop: "3px solid #3498db",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 0.5rem"
          }}></div>
          <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>Loading...</p>
        </div>
      ) : isPdfFile && fileUrl ? (
        <div>
          {/* PDF Controls */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            padding: "1rem",
            background: "linear-gradient(135deg, #ffffff, #f8f9fa)",
            borderRadius: "12px",
            border: "2px solid #e9ecef",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.9rem", color: "#666" }}>
                {numPages ? `${numPages} pages` : 'Loading...'}
              </span>
            </div>
            
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                onClick={() => setPdfZoom(Math.max(0.5, pdfZoom - 0.25))}
                style={{ 
                  padding: "0.5rem 0.75rem", 
                  fontSize: "0.9rem", 
                  border: "2px solid #3498db", 
                  borderRadius: "8px", 
                  background: "linear-gradient(135deg, #ffffff, #f8f9fa)",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#3498db"
                }}
              >
                −
              </button>
              <span style={{ 
                fontSize: "0.9rem", 
                color: "#2c3e50", 
                minWidth: "60px", 
                textAlign: "center",
                fontWeight: "600",
                padding: "0.5rem",
                background: "#e9ecef",
                borderRadius: "8px"
              }}>{Math.round(pdfZoom * 100)}%</span>
              <button
                onClick={() => setPdfZoom(Math.min(3, pdfZoom + 0.25))}
                style={{ 
                  padding: "0.5rem 0.75rem", 
                  fontSize: "0.9rem", 
                  border: "2px solid #3498db", 
                  borderRadius: "8px", 
                  background: "linear-gradient(135deg, #ffffff, #f8f9fa)",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#3498db"
                }}
              >
                +
              </button>
              <button
                onClick={() => setPdfZoom(1)}
                style={{ 
                  padding: "0.5rem 0.75rem", 
                  fontSize: "0.8rem", 
                  border: "2px solid #28a745", 
                  borderRadius: "8px", 
                  background: "linear-gradient(135deg, #28a745, #20c997)",
                  marginLeft: "0.75rem",
                  cursor: "pointer",
                  color: "white",
                  fontWeight: "600"
                }}
              >
                Reset
              </button>
              <button
                onClick={() => {
                  const element = document.querySelector('.pdf-container');
                  if (element.requestFullscreen) {
                    element.requestFullscreen();
                  } else if (element.webkitRequestFullscreen) {
                    element.webkitRequestFullscreen();
                  }
                }}
                style={{ 
                  padding: "0.5rem 0.75rem", 
                  fontSize: "0.8rem", 
                  border: "2px solid #6f42c1", 
                  borderRadius: "8px", 
                  background: "linear-gradient(135deg, #6f42c1, #5a32a3)",
                  marginLeft: "0.75rem",
                  cursor: "pointer",
                  color: "white",
                  fontWeight: "600"
                }}
              >
                ⛶ Full
              </button>
            </div>
          </div>
          
          {/* PDF Viewer */}
          <div className="pdf-container" style={{
            border: "1px solid #ddd",
            borderRadius: "4px",
            background: "#f8f9fa",
            textAlign: "center",
            overflow: "auto",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "1rem",
            position: "relative"
          }}>
            {/* Exit Fullscreen Button - only visible in fullscreen */}
            <button
              onClick={() => {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                  document.webkitExitFullscreen();
                }
              }}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                padding: "0.5rem 1rem",
                fontSize: "0.9rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "rgba(255,255,255,0.9)",
                cursor: "pointer",
                zIndex: 1000,
                display: "none"
              }}
              className="exit-fullscreen-btn"
            >
              ✕ Exit Fullscreen
            </button>
            {pdfError ? (
              <div style={{ padding: "2rem", color: "#dc3545" }}>
                <p>❌ {pdfError}</p>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3498db" }}>
                  Open in browser instead
                </a>
              </div>
            ) : (
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div style={{ padding: "2rem" }}>
                    <div style={{
                      width: "24px",
                      height: "24px",
                      border: "3px solid #f3f3f3",
                      borderTop: "3px solid #3498db",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      margin: "0 auto 0.5rem"
                    }}></div>
                    <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>Loading PDF...</p>
                  </div>
                }
              >
                {Array.from(new Array(numPages), (el, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={pdfZoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    style={{ marginBottom: "1rem" }}
                  />
                ))}
              </Document>
            )}
            
            <style>{`
              .pdf-container:fullscreen .exit-fullscreen-btn {
                display: block !important;
              }
              .pdf-container:-webkit-full-screen .exit-fullscreen-btn {
                display: block !important;
              }
            `}</style>
          </div>
          
          <div style={{ marginTop: "0.5rem", textAlign: "center", display: "flex", justifyContent: "center", gap: "1rem" }}>
            <a 
              href={fileUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ fontSize: "0.8rem", color: "#3498db", textDecoration: "none" }}
            >
              🔗 Open in new tab
            </a>
            <a
              href={fileUrl}
              download={activeFile.name}
              style={{ fontSize: "0.8rem", color: "#3498db", textDecoration: "none" }}
            >
              📥 Download PDF
            </a>
          </div>
        </div>
      ) : isDocxFile && fileUrl ? (
        <div style={{
          border: "1px solid #ddd",
          borderRadius: "4px",
          background: "#fff",
          minHeight: "600px"
        }}>
          <DocViewer
            documents={[{ uri: fileUrl, fileName: activeFile.name }]}
            pluginRenderers={DocViewerRenderers}
            config={{
              header: {
                disableHeader: false,
                disableFileName: false,
                retainURLParams: false
              }
            }}
            style={{ height: "600px" }}
          />
        </div>
      ) : isDocxFile && fileUrl ? (
        <div style={{
          border: "1px solid #ddd",
          borderRadius: "4px",
          background: "#fff",
          minHeight: "600px",
          padding: "1rem"
        }}>
          <DocViewer
            documents={[{ uri: fileUrl, fileName: activeFile.name }]}
            pluginRenderers={DocViewerRenderers}
            config={{
              header: {
                disableHeader: false,
                disableFileName: false,
                retainURLParams: false
              }
            }}
            style={{ height: "600px" }}
          />
        </div>
      ) : fileUrl ? (
        <div style={{
          padding: "2rem",
          textAlign: "center",
          background: "#f8f9fa",
          borderRadius: "8px"
        }}>
          <p><strong>File:</strong> {activeFile.name}</p>
          <p><strong>Type:</strong> {getFileType(activeFile.name)}</p>
          <a
            href={fileUrl}
            download={activeFile.name}
            className="btn"
            style={{ marginTop: "1rem", textDecoration: "none" }}
          >
            📥 Download File
          </a>
        </div>
      ) : (
        <div style={{
          padding: "2rem",
          textAlign: "center",
          background: "#f8f9fa",
          borderRadius: "8px",
          color: "#666"
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>
            {getFileIcon(activeFile.name)}
          </div>
          <p style={{ fontSize: "1.1rem", fontWeight: "500", margin: "0 0 0.5rem 0" }}>
            {activeFile.name}
          </p>
          <p style={{ fontSize: "0.9rem", margin: "0 0 0.5rem 0" }}>
            {getFileType(activeFile.name)}
          </p>
          <p style={{ fontSize: "0.8rem", color: "#999", margin: 0 }}>
            Click to load content
          </p>
        </div>
      )}
    </div>
  );
};

const Review = () => {
  const { dossier, getFileBlob } = useDossier();
  const [allFiles, setAllFiles] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [fileUrls, setFileUrls] = useState(new Map());
  const [loadedFiles, setLoadedFiles] = useState(new Set());
  const [loadingFiles, setLoadingFiles] = useState(new Set());
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { debouncedCallback: debouncedSearch } = useDebounce((term) => {
    // Debounced search logic can be added here if needed
  }, 300);

  const [pdfZoom, setPdfZoom] = useState(1);

  const observerRef = useRef(null);
  const preloadQueueRef = useRef(new Set());

  const extractAllFiles = (node, depth = 0) => {
    let files = [];
    
    if (node.children) {
      // Process children in their original tree order - no sorting
      node.children.forEach((child) => {
        if (child.type === "file") {
          files.push({ ...child, depth });
        } else if (child.type === "folder") {
          // Recursively get files from subfolders
          files = files.concat(extractAllFiles(child, depth + 1));
        }
      });
    }
    
    // If this is the root call and node itself is a file
    if (node.type === "file" && depth === 0) {
      files.push({ ...node, depth });
    }
    
    return files;
  };

  const { deduplicatedRequest } = useRequestDeduplication();
  
  const loadFileUrl = useCallback(
    async (filePath) => {
      return deduplicatedRequest(filePath, async () => {
        if (loadingFiles.has(filePath)) return;

        setLoadingFiles((prev) => new Set(prev).add(filePath));

        try {
          const fileData = await getFileBlob(filePath);
          if (fileData && fileData.blob instanceof Blob) {
            const typedBlob = new Blob([fileData.blob], { 
              type: fileData.type || fileData.blob.type || 'application/octet-stream' 
            });
            const blobUrl = URL.createObjectURL(typedBlob);
            setFileUrls((prev) => new Map(prev).set(filePath, blobUrl));
          }
        } catch (error) {
          console.error("Failed to load file:", filePath, error);
        } finally {
          setLoadingFiles((prev) => {
            const newSet = new Set(prev);
            newSet.delete(filePath);
            return newSet;
          });
        }
      });
    },
    [getFileBlob, loadingFiles, deduplicatedRequest]
  );

  const preloadNextFiles = useCallback(
    (currentFilePath) => {
      const currentIndex = allFiles.findIndex(
        (f) => f.path === currentFilePath
      );
      if (currentIndex === -1) return;

      // Preload next 2 files
      for (let i = 1; i <= 2; i++) {
        const nextIndex = currentIndex + i;
        if (
          nextIndex < allFiles.length &&
          !preloadQueueRef.current.has(allFiles[nextIndex].path)
        ) {
          preloadQueueRef.current.add(allFiles[nextIndex].path);
          setTimeout(() => loadFileUrl(allFiles[nextIndex].path), i * 500);
        }
      }
    },
    [allFiles, loadFileUrl]
  );

  const filteredFiles = allFiles.filter(
    (file) =>
      searchTerm === "" ||
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (dossier) {
      const files = extractAllFiles(dossier.root);
      setAllFiles(files);
    } else {
      setAllFiles([]);
    }
  }, [dossier]);

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsNavCollapsed(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      fileUrls.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [fileUrls]);

  // Cleanup when switching files
  useEffect(() => {
    const cleanup = () => {
      // Force garbage collection of unused PDF resources
      setTimeout(() => {
        if (window.gc) window.gc();
      }, 100);
    };
    cleanup();
  }, [activeTabIndex]);



  const openFileInTab = (file) => {
    const existingTabIndex = openTabs.findIndex(tab => tab.path === file.path);
    if (existingTabIndex >= 0) {
      setActiveTabIndex(existingTabIndex);
    } else {
      setOpenTabs(prev => [...prev, file]);
      setActiveTabIndex(openTabs.length);
    }
    // Always load the file when opening/switching
    loadFileUrl(file.path);
  };

  const closeTab = (index) => {
    const newTabs = openTabs.filter((_, i) => i !== index);
    setOpenTabs(newTabs);
    if (activeTabIndex >= newTabs.length) {
      setActiveTabIndex(Math.max(0, newTabs.length - 1));
    } else if (activeTabIndex > index) {
      setActiveTabIndex(activeTabIndex - 1);
    }
  };

  const getActiveFile = () => {
    return openTabs[activeTabIndex] || null;
  };

  const getFileId = (path) => {
    return "file-" + path.replace(/[^a-zA-Z0-9]/g, "-");
  };

  const isPdf = (fileName) => {
    return fileName.toLowerCase().endsWith(".pdf");
  };

  const isDocx = (fileName) => {
    const ext = fileName.toLowerCase();
    return ext.endsWith('.docx') || ext.endsWith('.doc');
  };

  const isPdfPath = (path) => {
    return path.toLowerCase().endsWith(".pdf");
  };

  const getFileType = (fileName) => {
    const ext = fileName.toLowerCase().split(".").pop();
    const types = {
      pdf: "PDF Document",
      doc: "Word Document",
      docx: "Word Document",
      xls: "Excel Spreadsheet",
      xlsx: "Excel Spreadsheet",
      txt: "Text File",
      html: "HTML Document",
      xml: "XML Document",
      jpg: "JPEG Image",
      png: "PNG Image",
    };
    return types[ext] || "Unknown File Type";
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.toLowerCase().split(".").pop();
    const icons = {
      pdf: "📄",
      doc: "📝", docx: "📝",
      xls: "📊", xlsx: "📊",
      txt: "📄",
      html: "🌐", xml: "🌐",
      jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️",
      zip: "📦", rar: "📦"
    };
    return icons[ext] || "📄";
  };

  const navigateFiles = (direction) => {
    if (openTabs.length === 0) return;
    
    const newIndex = direction === "next"
      ? Math.min(openTabs.length - 1, activeTabIndex + 1)
      : Math.max(0, activeTabIndex - 1);
    
    if (newIndex !== activeTabIndex) {
      setActiveTabIndex(newIndex);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === "INPUT") return;

      switch (e.key) {
        case "ArrowLeft":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigateFiles("prev");
          }
          break;
        case "ArrowRight":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            navigateFiles("next");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [activeTabIndex, openTabs]);

  if (!dossier) {
    return (
      <div className="container">
        <div className="card">
          <h2>Document Review</h2>
          <p>No dossier loaded. Please upload a dossier first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="review-container" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <div
        className={`file-nav ${isNavCollapsed ? "collapsed" : ""}`}
        style={{
          width: isNavCollapsed ? "50px" : "320px",
          borderRight: "1px solid #e0e0e0",
          backgroundColor: "#fafafa",
          transition: "width 0.3s ease",
        }}
      >
        <div
          style={{
            padding: "1rem",
            borderBottom: "2px solid #e9ecef",
            background: "linear-gradient(135deg, #3498db, #2980b9)",
            color: "white"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: isNavCollapsed ? "center" : "space-between",
              alignItems: "center",
              marginBottom: isNavCollapsed ? 0 : "1rem",
            }}
          >
            {!isNavCollapsed && (
              <h3 style={{ margin: 0, fontSize: "1rem" }}>
                Files ({filteredFiles.length}/{allFiles.length})
              </h3>
            )}
            <button
              onClick={() => setIsNavCollapsed(!isNavCollapsed)}
              style={{
                padding: "0.5rem",
                fontSize: "0.9rem",
                minWidth: "36px",
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                transition: "all 0.2s ease"
              }}
            >
              {isNavCollapsed ? "→" : "←"}
            </button>
          </div>

          {!isNavCollapsed && (
            <div>
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                }}
              />
              {searchTerm && (
                <div style={{
                  fontSize: "0.8rem",
                  color: "#666",
                  marginTop: "0.5rem",
                  padding: "0.25rem 0.5rem",
                  background: filteredFiles.length > 0 ? "#e8f5e8" : "#ffeaa7",
                  borderRadius: "3px"
                }}>
                  {filteredFiles.length > 0 
                    ? `Found ${filteredFiles.length} file${filteredFiles.length > 1 ? 's' : ''}`
                    : 'No files found'
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {!isNavCollapsed && dossier.root && (
          <div
            style={{
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
              padding: "0 0.5rem",
            }}
          >
            {searchTerm ? (
              // Show search results as a flat list
              <div style={{ padding: "0.5rem" }}>
                {filteredFiles.map((file, index) => (
                  <div
                    key={file.path}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openFileInTab(file);
                    }}
                    style={{
                      padding: "0.5rem",
                      cursor: "pointer",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      marginBottom: "0.25rem",
                      background: file.path === (getActiveFile()?.path || "") ? "#e3f2fd" : "transparent",
                      border: "1px solid #eee",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#f5f5f5"}
                    onMouseOut={(e) => e.currentTarget.style.background = file.path === (getActiveFile()?.path || "") ? "#e3f2fd" : "transparent"}
                  >
                    <span>📄</span>
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {file.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show normal tree view
              (() => {
                const actualDossier = dossier.root.children?.find(child => 
                  child.type === 'folder' && child.name !== '__MACOSX' && child.name !== '_MACOSX'
                );
                
                return actualDossier ? (
                  <DossierTree
                    node={actualDossier}
                    activeFilePath={getActiveFile()?.path || ""}
                    onFileSelected={openFileInTab}
                    level={0}
                  />
                ) : (
                  <DossierTree
                    node={dossier.root}
                    activeFilePath={getActiveFile()?.path || ""}
                    onFileSelected={openFileInTab}
                  />
                );
              })()
            )}}}
          </div>
        )}
      </div>

      <div className="file-viewer" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Tab Bar */}
        {openTabs.length > 0 && (
          <div style={{
            display: "flex",
            background: "#f8f9fa",
            borderBottom: "1px solid #e0e0e0",
            overflowX: "auto",
            minHeight: "48px",
            scrollbarWidth: "thin",
            WebkitOverflowScrolling: "touch"
          }}>
            {openTabs.map((tab, index) => (
              <div
                key={tab.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem 1rem",
                  background: index === activeTabIndex ? "#fff" : "transparent",
                  borderBottom: index === activeTabIndex ? "2px solid #3498db" : "none",
                  cursor: "pointer",
                  minWidth: "150px",
                  maxWidth: "250px",
                  flexShrink: 0,
                  borderRight: "1px solid #e0e0e0"
                }}
                onClick={() => {
                  setActiveTabIndex(index);
                  loadFileUrl(tab.path);
                }}
              >
                <span style={{ fontSize: "1rem", marginRight: "0.5rem" }}>
                  {getFileIcon(tab.name)}
                </span>
                <span style={{
                  flex: 1,
                  fontSize: "0.9rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: index === activeTabIndex ? "#2c3e50" : "#666"
                }}>
                  {tab.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(index);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    padding: "0.2rem",
                    marginLeft: "0.5rem",
                    color: "#999",
                    borderRadius: "3px"
                  }}
                  onMouseOver={(e) => e.target.style.background = "#f0f0f0"}
                  onMouseOut={(e) => e.target.style.background = "none"}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {openTabs.length === 0 ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#666",
              fontSize: "1.1rem"
            }}>
              📁 Select a file from the sidebar to open it in a tab
            </div>
          ) : (
            getActiveFile() && (
              <TabContent 
                activeFile={getActiveFile()}
                isLoading={loadingFiles.has(getActiveFile().path)}
                fileUrl={fileUrls.get(getActiveFile().path)}
                isPdfFile={isPdf(getActiveFile().name)}
                isDocxFile={isDocx(getActiveFile().name)}

                pdfZoom={pdfZoom}
                setPdfZoom={setPdfZoom}
                getFileIcon={getFileIcon}
                getFileType={getFileType}
              />
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default Review;
