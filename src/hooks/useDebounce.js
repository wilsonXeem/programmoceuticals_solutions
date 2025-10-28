import { useCallback, useRef } from 'react';

export const useDebounce = (callback, delay = 300) => {
  const timeoutRef = useRef(null);
  const requestsRef = useRef(new Map());

  const debouncedCallback = useCallback((...args) => {
    const key = JSON.stringify(args);
    
    // If same request is already pending, return existing promise
    if (requestsRef.current.has(key)) {
      return requestsRef.current.get(key);
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new promise for this request
    const promise = new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        try {
          const result = await callback(...args);
          requestsRef.current.delete(key);
          resolve(result);
        } catch (error) {
          requestsRef.current.delete(key);
          reject(error);
        }
      }, delay);
    });

    requestsRef.current.set(key, promise);
    return promise;
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    requestsRef.current.clear();
  }, []);

  return { debouncedCallback, cancel };
};

export const useRequestDeduplication = () => {
  const activeRequestsRef = useRef(new Map());

  const deduplicatedRequest = useCallback(async (key, requestFn) => {
    // If request is already in progress, return existing promise
    if (activeRequestsRef.current.has(key)) {
      return activeRequestsRef.current.get(key);
    }

    // Create new request
    const promise = requestFn().finally(() => {
      activeRequestsRef.current.delete(key);
    });

    activeRequestsRef.current.set(key, promise);
    return promise;
  }, []);

  const clearRequests = useCallback(() => {
    activeRequestsRef.current.clear();
  }, []);

  return { deduplicatedRequest, clearRequests };
};