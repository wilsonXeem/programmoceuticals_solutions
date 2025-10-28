import React, { useState } from 'react';
import ProgressivePDFViewer from './ProgressivePDFViewer';

const MultiDocumentViewer = ({ documents, onClose, title }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' or 'split'

  return (
    <div className="multi-document-viewer">
      <div className="viewer-header">
        <h3>{title}</h3>
        <div className="viewer-controls">
          <button 
            onClick={() => setViewMode(viewMode === 'tabs' ? 'split' : 'tabs')}
            className="view-toggle"
          >
            {viewMode === 'tabs' ? 'Split View' : 'Tab View'}
          </button>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
      </div>

      {viewMode === 'tabs' ? (
        <>
          <div className="document-tabs">
            {documents.map((doc, index) => (
              <button
                key={index}
                className={`tab ${activeTab === index ? 'active' : ''}`}
                onClick={() => setActiveTab(index)}
              >
                {doc.moduleRef}
              </button>
            ))}
          </div>
          <div className="document-content">
            {documents[activeTab] && (
              <ProgressivePDFViewer
                file={documents[activeTab].filePath}
                title={documents[activeTab].moduleRef}
              />
            )}
          </div>
        </>
      ) : (
        <div className="split-view">
          {documents.map((doc, index) => (
            <div key={index} className="split-panel">
              <div className="panel-header">{doc.moduleRef}</div>
              <ProgressivePDFViewer
                file={doc.filePath}
                title={doc.moduleRef}
              />
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .multi-document-viewer {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: white;
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }
        
        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #ddd;
          background: #f5f5f5;
        }
        
        .viewer-controls {
          display: flex;
          gap: 1rem;
        }
        
        .view-toggle, .close-btn {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px;
        }
        
        .close-btn {
          background: #ff4444;
          color: white;
          border: none;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
        }
        
        .document-tabs {
          display: flex;
          border-bottom: 1px solid #ddd;
          background: #f9f9f9;
        }
        
        .tab {
          padding: 1rem 2rem;
          border: none;
          background: transparent;
          cursor: pointer;
          border-bottom: 3px solid transparent;
        }
        
        .tab.active {
          background: white;
          border-bottom-color: #007bff;
        }
        
        .document-content {
          flex: 1;
          overflow: hidden;
        }
        
        .split-view {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1px;
          background: #ddd;
        }
        
        .split-panel {
          background: white;
          display: flex;
          flex-direction: column;
        }
        
        .panel-header {
          padding: 0.5rem;
          background: #f0f0f0;
          font-weight: bold;
          text-align: center;
          border-bottom: 1px solid #ddd;
        }
      `}</style>
    </div>
  );
};

export default MultiDocumentViewer;