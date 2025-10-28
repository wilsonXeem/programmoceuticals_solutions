import { useState, useCallback } from 'react';

export const useRetry = (maxRetries = 3, baseDelay = 1000) => {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const executeWithRetry = useCallback(async (operation, options = {}) => {
    const {
      maxRetries: customMaxRetries = maxRetries,
      baseDelay: customBaseDelay = baseDelay,
      exponentialBackoff = true,
      onRetry = null,
      shouldRetry = (error) => true
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= customMaxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setIsRetrying(true);
          setRetryCount(attempt);
          
          const delay = exponentialBackoff 
            ? customBaseDelay * Math.pow(2, attempt - 1)
            : customBaseDelay;
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          if (onRetry) {
            onRetry(attempt, lastError);
          }
        }

        const result = await operation();
        
        // Reset state on success
        setRetryCount(0);
        setIsRetrying(false);
        
        return { success: true, data: result, attempts: attempt + 1 };
        
      } catch (error) {
        lastError = error;
        
        // Don't retry if shouldRetry returns false
        if (!shouldRetry(error)) {
          break;
        }
        
        // If this was the last attempt, don't continue
        if (attempt === customMaxRetries) {
          break;
        }
      }
    }
    
    setIsRetrying(false);
    setRetryCount(0);
    
    return { 
      success: false, 
      error: lastError, 
      attempts: customMaxRetries + 1 
    };
  }, [maxRetries, baseDelay]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    executeWithRetry,
    retryCount,
    isRetrying,
    reset
  };
};

// Specific retry hooks for common operations
export const useFileOperationRetry = () => {
  return useRetry(3, 1000, {
    shouldRetry: (error) => {
      // Retry on network errors, timeout, or temporary failures
      return error.name === 'NetworkError' || 
             error.message.includes('timeout') ||
             error.message.includes('Failed to fetch') ||
             error.status >= 500;
    }
  });
};

export const useZipProcessingRetry = () => {
  return useRetry(2, 2000, {
    shouldRetry: (error) => {
      // Don't retry on invalid ZIP files or corruption
      return !error.message.includes('invalid') && 
             !error.message.includes('corrupt') &&
             !error.message.includes('unsupported');
    }
  });
};