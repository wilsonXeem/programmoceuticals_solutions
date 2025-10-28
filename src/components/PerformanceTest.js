import React, { useState, useRef, useCallback } from 'react';
import { useDossier } from '../hooks/useDossier';
import EnhancedProgressIndicator from './EnhancedProgressIndicator';

const PerformanceTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const { uploadDossier, clearDossier } = useDossier();
  const metricsRef = useRef({});

  const generateTestFile = useCallback(async (sizeType) => {
    // Create a mock large ZIP file for testing
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    const sizes = {
      small: { files: 50, avgSize: 1024 * 10 }, // 50 files, 10KB each
      medium: { files: 200, avgSize: 1024 * 50 }, // 200 files, 50KB each  
      large: { files: 500, avgSize: 1024 * 100 }, // 500 files, 100KB each
      xlarge: { files: 1000, avgSize: 1024 * 200 } // 1000 files, 200KB each
    };
    
    const config = sizes[sizeType];
    
    // Create folder structure
    const modules = ['Module 1', 'Module 2', 'Module 3'];
    const subfolders = ['Documents', 'Reports', 'Data', 'Images'];
    
    for (let m = 0; m < modules.length; m++) {
      const moduleFolder = zip.folder(modules[m]);
      
      for (let s = 0; s < subfolders.length; s++) {
        const subFolder = moduleFolder.folder(subfolders[s]);
        
        const filesPerFolder = Math.floor(config.files / (modules.length * subfolders.length));
        
        for (let f = 0; f < filesPerFolder; f++) {
          const fileName = `document_${m}_${s}_${f}.pdf`;
          const fileContent = new Array(config.avgSize).fill('A').join('');
          subFolder.file(fileName, fileContent);
        }
      }
    }
    
    const blob = await zip.generateAsync({ type: 'blob' });
    return new File([blob], `test_${sizeType}_${config.files}files.zip`, { type: 'application/zip' });
  }, []);

  const runPerformanceTest = useCallback(async (sizeType) => {
    const startTime = Date.now();
    metricsRef.current = {
      startTime,
      sizeType,
      memoryStart: performance.memory ? performance.memory.usedJSHeapSize : 0,
      phases: {}
    };

    setCurrentTest({
      type: sizeType,
      phase: 'Generating test file...',
      progress: 0,
      startTime
    });

    try {
      // Generate test file
      const file = await generateTestFile(sizeType);
      setTestFile(file);
      
      metricsRef.current.phases.fileGeneration = Date.now() - startTime;
      
      setCurrentTest(prev => ({
        ...prev,
        phase: 'Processing ZIP file...',
        progress: 20
      }));

      // Clear any existing data
      await clearDossier();
      
      // Track processing phases
      const phaseStartTime = Date.now();
      
      const result = await uploadDossier(file, (progress) => {
        if (typeof progress === 'number') {
          setCurrentTest(prev => ({
            ...prev,
            progress: 20 + (progress * 0.8),
            phase: `Processing... ${Math.round(progress)}%`
          }));
        } else if (progress.type === 'tree_ready') {
          metricsRef.current.phases.treeProcessing = Date.now() - phaseStartTime;
        } else if (progress.type === 'batch_progress') {
          setCurrentTest(prev => ({
            ...prev,
            progress: 20 + (progress.progress * 0.8),
            phase: `Processing files... ${progress.processed}/${progress.total}`
          }));
        }
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const testResult = {
        id: Date.now(),
        sizeType,
        success: result.success,
        totalTime,
        fileSize: file.size,
        formattedSize: formatFileSize(file.size),
        phases: metricsRef.current.phases,
        memoryUsed: performance.memory ? 
          performance.memory.usedJSHeapSize - metricsRef.current.memoryStart : 0,
        timestamp: new Date().toLocaleTimeString(),
        error: result.error
      };

      setTestResults(prev => [testResult, ...prev]);
      setCurrentTest(null);
      
    } catch (error) {
      const testResult = {
        id: Date.now(),
        sizeType,
        success: false,
        error: error.message,
        totalTime: Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setTestResults(prev => [testResult, ...prev]);
      setCurrentTest(null);
    }
  }, [uploadDossier, clearDossier, generateTestFile]);

  const formatFileSize = (bytes) => {
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPerformanceRating = (time, size) => {
    const ratio = time / (size / (1024 * 1024)); // ms per MB
    if (ratio < 500) return { rating: 'Excellent', color: '#28a745' };
    if (ratio < 1000) return { rating: 'Good', color: '#ffc107' };
    if (ratio < 2000) return { rating: 'Fair', color: '#fd7e14' };
    return { rating: 'Poor', color: '#dc3545' };
  };

  const clearResults = () => {
    setTestResults([]);
    setCurrentTest(null);
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🚀 Performance Testing Suite</h2>
      <p>Test the performance improvements with different file sizes and measure processing times.</p>
      
      {/* Test Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        {['small', 'medium', 'large', 'xlarge'].map(size => (
          <button
            key={size}
            onClick={() => runPerformanceTest(size)}
            disabled={!!currentTest}
            style={{
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: currentTest?.type === size ? '#e3f2fd' : '#fff',
              cursor: currentTest ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {size.charAt(0).toUpperCase() + size.slice(1)} Test
            <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
              {size === 'small' && '~50 files'}
              {size === 'medium' && '~200 files'}
              {size === 'large' && '~500 files'}
              {size === 'xlarge' && '~1000 files'}
            </div>
          </button>
        ))}
      </div>

      {/* Current Test Progress */}
      {currentTest && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1rem',
          background: '#f8f9fa'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>
            Running {currentTest.type} test...
          </h4>
          <EnhancedProgressIndicator
            progress={currentTest.progress}
            type="circular"
            startTime={currentTest.startTime}
            currentItem={currentTest.phase}
            showTimeEstimate={true}
          />
        </div>
      )}

      {/* Results Controls */}
      {testResults.length > 0 && (
        <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
          <button
            onClick={clearResults}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #dc3545',
              borderRadius: '4px',
              background: '#fff',
              color: '#dc3545',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Clear Results
          </button>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div>
          <h3>📊 Test Results</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {testResults.map(result => {
              const performance = result.success ? 
                getPerformanceRating(result.totalTime, result.fileSize) : 
                { rating: 'Failed', color: '#dc3545' };
              
              return (
                <div
                  key={result.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    background: result.success ? '#fff' : '#fff5f5'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <strong>{result.sizeType.toUpperCase()} Test</strong>
                      <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                        {result.timestamp}
                      </span>
                    </div>
                    <div style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '3px',
                      background: performance.color,
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}>
                      {performance.rating}
                    </div>
                  </div>
                  
                  {result.success ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', fontSize: '0.9rem' }}>
                      <div>
                        <strong>Total Time:</strong><br />
                        {formatTime(result.totalTime)}
                      </div>
                      <div>
                        <strong>File Size:</strong><br />
                        {result.formattedSize}
                      </div>
                      <div>
                        <strong>Processing Rate:</strong><br />
                        {((result.fileSize / (1024 * 1024)) / (result.totalTime / 1000)).toFixed(1)} MB/s
                      </div>
                      {result.memoryUsed > 0 && (
                        <div>
                          <strong>Memory Used:</strong><br />
                          {formatFileSize(result.memoryUsed)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#dc3545' }}>
                      <strong>Error:</strong> {result.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Tips */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: '#e8f4fd',
        borderRadius: '4px',
        border: '1px solid #bee5eb'
      }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>💡 Performance Optimizations Active</h4>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
          <li>Progressive PDF loading with intersection observer</li>
          <li>Virtual scrolling for large file trees</li>
          <li>Request debouncing and deduplication</li>
          <li>Background processing for non-critical tasks</li>
          <li>Dynamic memory-based cache sizing</li>
          <li>Retry logic with exponential backoff</li>
        </ul>
      </div>
    </div>
  );
};

export default PerformanceTest;