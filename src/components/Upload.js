import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDossier } from '../hooks/useDossier';
import EnhancedProgressIndicator from './EnhancedProgressIndicator';

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStartTime, setUploadStartTime] = useState(null);
  const { uploadDossier, clearDossier, loading } = useDossier();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    processSelectedFile(file);
  };

  const processSelectedFile = (file) => {
    if (!file) return;
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setStatus('❌ Please select a ZIP file');
      return;
    }
    
    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      setStatus('❌ File too large. Maximum size is 500MB');
      return;
    }
    
    setSelectedFile(file);
    setStatus('');
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processSelectedFile(files[0]);
    }
  }, []);

  const handleProgress = useCallback((progressData) => {
    if (typeof progressData === 'number') {
      setProgress({ 
        type: 'basic', 
        value: progressData,
        startTime: uploadStartTime
      });
      setStatus(`Processing... ${Math.round(progressData)}%`);
    } else if (progressData.type === 'tree_ready') {
      setStatus('📁 File structure ready, processing files...');
      setProgress({ 
        type: 'basic',
        value: 25,
        startTime: uploadStartTime
      });
    } else if (progressData.type === 'batch_progress') {
      setProgress({
        type: 'basic',
        value: progressData.progress,
        processed: progressData.processed,
        total: progressData.total,
        filesReady: progressData.filesReady,
        startTime: uploadStartTime,
        currentItem: progressData.currentFile
      });
      setStatus(`Processing files... ${progressData.processed}/${progressData.total} (${Math.round(progressData.progress)}%)`);
    } else if (progressData.type === 'file_progress') {
      const fileName = progressData.file.split('/').pop();
      setProgress({
        type: 'basic',
        value: progressData.progress,
        startTime: uploadStartTime,
        currentItem: fileName
      });
      setStatus(`Processing large file: ${fileName}... ${Math.round(progressData.progress)}%`);
    }
  }, [uploadStartTime]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    const startTime = Date.now();
    setUploadStartTime(startTime);
    setStatus('🔄 Starting ZIP processing...');
    setProgress({ type: 'basic', value: 0, startTime });
    
    const result = await uploadDossier(selectedFile, handleProgress);
    
    if (result.success) {
      setProgress(null);
      setStatus('✅ Dossier uploaded successfully!');
      setTimeout(() => navigate('/screening'), 1500);
    } else {
      setStatus(`❌ Error processing dossier: ${result.error || 'Unknown error'}`);
      setProgress(null);
      setUploadStartTime(null);
    }
  };

  const handleClearAll = () => {
    clearDossier();
    setSelectedFile(null);
    setStatus('All data cleared');
    setProgress(null);
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Upload Dossier</h2>
        <p>Select a ZIP file containing your pharmaceutical dossier documents.</p>
        
        {/* Drag and Drop Zone */}
        <div 
          style={{
            border: `2px dashed ${isDragOver ? '#007bff' : '#ddd'}`,
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            marginBottom: '1rem',
            backgroundColor: isDragOver ? '#f8f9ff' : '#fafafa',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {isDragOver ? '📂' : '📁'}
          </div>
          <p style={{ margin: '0.5rem 0', fontSize: '1.1rem', fontWeight: '500' }}>
            {selectedFile ? selectedFile.name : 'Drop your ZIP file here or click to browse'}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
            {selectedFile ? 
              `Size: ${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : 
              'Maximum file size: 500MB'
            }
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={loading}
            style={{ display: 'none' }}
          />
        </div>

        <div>
          <button 
            className="btn" 
            onClick={handleUpload}
            disabled={!selectedFile || loading}
          >
            {loading ? 'Processing...' : 'Upload Dossier'}
          </button>
          
          <button 
            className="btn btn-danger" 
            onClick={handleClearAll}
            disabled={loading}
          >
            Clear All Data
          </button>
        </div>

        {status && (
          <div className={`status ${status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : ''}`}>
            {status}
          </div>
        )}
        
        {progress && (
          <div style={{ marginTop: '1rem' }}>
            <EnhancedProgressIndicator
              progress={progress.value || 0}
              type={progress.type}
              startTime={progress.startTime}
              totalItems={progress.total}
              processedItems={progress.processed}
              currentItem={progress.currentItem}
              showTimeEstimate={true}
              showThroughput={progress.type === 'batch'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;