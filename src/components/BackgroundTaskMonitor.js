import React, { useState, useEffect } from 'react';
import { backgroundProcessor } from '../services/backgroundProcessor';

const BackgroundTaskMonitor = ({ show = false }) => {
  const [status, setStatus] = useState({ queueLength: 0, activeTasks: 0, totalProcessed: 0 });
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (!isVisible) return;

    const updateStatus = () => {
      setStatus(backgroundProcessor.getStatus());
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible || (status.queueLength === 0 && status.activeTasks === 0)) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '0.8rem',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      {status.activeTasks > 0 && (
        <div style={{
          width: '12px',
          height: '12px',
          border: '2px solid #fff',
          borderTop: '2px solid transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      <span>
        🔄 {status.activeTasks} active • {status.queueLength} queued
      </span>
    </div>
  );
};

export default BackgroundTaskMonitor;