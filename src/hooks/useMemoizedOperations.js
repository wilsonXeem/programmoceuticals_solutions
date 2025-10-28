import { useMemo, useCallback, useRef } from 'react';

// Cache for expensive operations
const operationCache = new Map();

export const useMemoizedOperations = () => {
  const cacheRef = useRef(operationCache);
  
  // Memoized checklist matching
  const memoizedChecklistMatch = useCallback((dossier, checklist) => {
    const cacheKey = `checklist-${dossier?.name}-${checklist.length}`;
    
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey);
    }
    
    if (!dossier?.root) return [];
    
    const results = checklist.map(item => {
      const found = findFileInTree(dossier.root, item.path);
      return {
        ...item,
        found: !!found,
        actualPath: found?.path || null
      };
    });
    
    cacheRef.current.set(cacheKey, results);
    return results;
  }, []);
  
  // Memoized file tree flattening
  const memoizedFlattenTree = useCallback((root) => {
    const cacheKey = `flatten-${root?.name}-${JSON.stringify(root?.children?.length)}`;
    
    if (cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey);
    }
    
    const flattened = [];
    const traverse = (node, level = 0) => {
      flattened.push({ ...node, level });
      if (node.children) {
        node.children.forEach(child => traverse(child, level + 1));
      }
    };
    
    if (root?.children) {
      root.children.forEach(child => traverse(child, 0));
    }
    
    cacheRef.current.set(cacheKey, flattened);
    return flattened;
  }, []);
  
  // Clear cache when needed
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);
  
  return {
    memoizedChecklistMatch,
    memoizedFlattenTree,
    clearCache
  };
};

// Helper function for file matching
function findFileInTree(node, targetPath) {
  if (!node) return null;
  
  const normalizedTarget = targetPath.toLowerCase();
  const normalizedNodePath = node.path?.toLowerCase() || '';
  
  // Exact match
  if (normalizedNodePath === normalizedTarget) {
    return node;
  }
  
  // Partial match for files
  if (node.type === 'file' && normalizedNodePath.includes(normalizedTarget.split('/').pop())) {
    return node;
  }
  
  // Search children
  if (node.children) {
    for (const child of node.children) {
      const found = findFileInTree(child, targetPath);
      if (found) return found;
    }
  }
  
  return null;
}