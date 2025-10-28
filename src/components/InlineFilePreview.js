import React, { useState, useEffect } from 'react';
import { useDossier } from '../hooks/useDossier';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const InlineFilePreview = ({ documents, title, onClose }) => {
  const { getFileBlob } = useDossier();
  const [activeFile, setActiveFile] = useState(0);
  const [fileUrls, setFileUrls] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [zoom, setZoom] = useState(1);
  
  useEffect(() => {
    const loadFiles = async () => {
      const urls = [];
      for (const doc of documents) {
        for (const file of doc.files) {
          try {
            const fileData = await getFileBlob(file.path);
            if (fileData && fileData.blob instanceof Blob) {
              const blobUrl = URL.createObjectURL(fileData.blob);
              urls.push({ url: blobUrl, name: file.name });
            }
          } catch (error) {
            console.error('Failed to load file:', error);
          }
        }
      }
      setFileUrls(urls);
    };
    
    if (documents && documents.length > 0) {
      loadFiles();
    }
    
    return () => {
      fileUrls.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [documents, getFileBlob]);
  if (!documents || documents.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        margin: '1rem 0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>No files found</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      margin: '1rem 0',
      background: 'white'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderBottom: '1px solid #dee2e6',
        background: '#f8f9fa'
      }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
      </div>

      {fileUrls.length > 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid #dee2e6', background: '#f8f9fa' }}>
          {fileUrls.map((file, index) => (
            <button
              key={index}
              onClick={() => setActiveFile(index)}
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeFile === index ? 'white' : 'transparent',
                borderBottom: activeFile === index ? '2px solid #3498db' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}
      
      <div style={{ padding: '1rem' }}>
        {fileUrls.length > 0 && fileUrls[activeFile] ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h5 style={{ margin: 0 }}>{fileUrls[activeFile].name}</h5>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>−</button>
                <span style={{ fontSize: '0.8rem' }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2, zoom + 0.25))} style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}>+</button>
              </div>
            </div>
            <div style={{ border: '1px solid #ddd', borderRadius: '4px', maxHeight: '600px', overflow: 'auto' }}>
              <Document
                file={fileUrls[activeFile].url}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                onLoadError={(error) => {
                  console.error('PDF load error:', error);
                  setNumPages(0);
                }}
                loading={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading PDF...</div>}
                error={<div style={{ padding: '2rem', textAlign: 'center', color: '#dc3545' }}>Error loading PDF. File may be corrupted or inaccessible.</div>}
              >
                {numPages > 0 ? Array.from(new Array(numPages), (el, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={zoom}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    style={{ marginBottom: '1rem' }}
                    onRenderError={(error) => console.error('Page render error:', error)}
                  />
                )) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>No pages to display</div>
                )}
              </Document>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Loading files...</div>
        )}
      </div>
    </div>
  );
};

export default InlineFilePreview;