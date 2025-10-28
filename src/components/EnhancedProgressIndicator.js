import React, { useState, useEffect, useMemo } from 'react';

const EnhancedProgressIndicator = ({ 
  progress, 
  type = 'basic', 
  startTime = null,
  totalItems = null,
  processedItems = null,
  currentItem = null,
  showTimeEstimate = true,
  showThroughput = true 
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    if (!startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime]);
  
  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return 'Unknown';
    
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };
  
  const timeEstimates = useMemo(() => {
    if (!startTime || !progress || progress <= 0) {
      return { eta: null, throughput: null, formattedEta: 'Calculating...', formattedElapsed: '0s', confidence: 'low' };
    }
    
    const elapsed = elapsedTime / 1000; // seconds
    
    // Use exponential smoothing for more stable estimates
    const smoothingFactor = 0.3;
    const currentRate = progress / elapsed;
    const smoothedRate = currentRate; // Could implement historical smoothing here
    
    const remaining = smoothedRate > 0 ? (100 - progress) / smoothedRate : null;
    const throughput = processedItems && elapsed > 0 ? processedItems / elapsed : null;
    
    // Confidence based on elapsed time and progress
    let confidence = 'low';
    if (elapsed > 5 && progress > 10) confidence = 'medium';
    if (elapsed > 15 && progress > 25) confidence = 'high';
    
    // Adjust estimates based on confidence
    let adjustedRemaining = remaining;
    if (confidence === 'low' && remaining) {
      adjustedRemaining = remaining * 1.5; // Add buffer for low confidence
    } else if (confidence === 'medium' && remaining) {
      adjustedRemaining = remaining * 1.2; // Smaller buffer for medium confidence
    }
    
    return {
      eta: adjustedRemaining,
      throughput,
      formattedEta: formatTime(adjustedRemaining),
      formattedElapsed: formatTime(elapsed),
      confidence,
      rate: smoothedRate.toFixed(1)
    };
  }, [progress, elapsedTime, startTime, processedItems]);
  
  const getProgressColor = () => {
    if (progress < 25) return '#dc3545'; // Red
    if (progress < 50) return '#fd7e14'; // Orange  
    if (progress < 75) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };
  
  const renderBasicProgress = () => (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        fontSize: '0.9rem'
      }}>
        <span style={{ fontWeight: '500' }}>
          {Math.round(progress)}%
        </span>
        {showTimeEstimate && (
          <span style={{ color: '#666', fontSize: '0.8rem' }}>
            {timeEstimates.formattedElapsed} elapsed
            {timeEstimates.eta && (
              <>
                {' • '}
                <span style={{ 
                  color: timeEstimates.confidence === 'high' ? '#28a745' : 
                         timeEstimates.confidence === 'medium' ? '#ffc107' : '#6c757d'
                }}>
                  {timeEstimates.formattedEta} remaining
                </span>
                <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>
                  ({timeEstimates.confidence})
                </span>
              </>
            )}
          </span>
        )}
      </div>
      
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: getProgressColor(),
          transition: 'width 0.3s ease, background-color 0.3s ease',
          position: 'relative'
        }}>
          {/* Animated shimmer effect */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            animation: progress < 100 ? 'shimmer 2s infinite' : 'none'
          }} />
        </div>
      </div>
    </div>
  );
  
  const renderBatchProgress = () => (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem'
      }}>
        <div>
          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>
            Processing Files: {processedItems}/{totalItems}
          </span>
          <span style={{ color: '#666', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
            ({Math.round(progress)}%)
          </span>
        </div>
        {showThroughput && timeEstimates.throughput && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#666' }}>
            <span>
              📄 {timeEstimates.throughput.toFixed(1)} files/sec
            </span>
            <span>
              📊 {timeEstimates.rate}%/sec
            </span>
          </div>
        )}
      </div>
      
      {currentItem && (
        <div style={{
          fontSize: '0.8rem',
          color: '#666',
          marginBottom: '0.5rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          Current: {currentItem}
        </div>
      )}
      
      <div style={{
        width: '100%',
        height: '6px',
        backgroundColor: '#e9ecef',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '0.25rem'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: getProgressColor(),
          transition: 'width 0.3s ease'
        }} />
      </div>
      
      {showTimeEstimate && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          color: '#999'
        }}>
          <span>Elapsed: {timeEstimates.formattedElapsed}</span>
          {timeEstimates.eta && (
            <span>ETA: {timeEstimates.formattedEta}</span>
          )}
        </div>
      )}
    </div>
  );
  
  const renderCircularProgress = () => {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <svg width="50" height="50" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="25"
              cy="25"
              r={radius}
              stroke="#e9ecef"
              strokeWidth="4"
              fill="transparent"
            />
            <circle
              cx="25"
              cy="25"
              r={radius}
              stroke={getProgressColor()}
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '0.7rem',
            fontWeight: '500'
          }}>
            {Math.round(progress)}%
          </div>
        </div>
        
        <div style={{ flex: 1 }}>
          {currentItem && (
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.25rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {currentItem}
            </div>
          )}
          {showTimeEstimate && (
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              {timeEstimates.formattedElapsed} elapsed
              {timeEstimates.eta && (
                <>
                  {' • '}
                  <span style={{ 
                    color: timeEstimates.confidence === 'high' ? '#28a745' : 
                           timeEstimates.confidence === 'medium' ? '#ffc107' : '#6c757d'
                  }}>
                    {timeEstimates.formattedEta} remaining
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  if (type === 'batch') return renderBatchProgress();
  if (type === 'circular') return renderCircularProgress();
  return renderBasicProgress();
};

export default EnhancedProgressIndicator;