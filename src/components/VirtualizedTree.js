import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

const VirtualizedTree = ({ node, activeFilePath, onFileSelected, maxHeight = 400, searchTerm = '' }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [keyboardNavActive, setKeyboardNavActive] = useState(false);
  const containerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  
  const itemHeight = 28;
  const visibleCount = Math.ceil(maxHeight / itemHeight);
  const bufferSize = Math.max(5, Math.floor(visibleCount * 0.5)); // Buffer for smooth scrolling
  
  // Flatten tree structure for virtualization with search filtering
  const flattenedItems = useMemo(() => {
    const items = [];
    const searchLower = searchTerm.toLowerCase();
    
    const traverse = (node, level = 0, parentMatches = false) => {
      const nodeMatches = !searchTerm || 
        node.name.toLowerCase().includes(searchLower) ||
        node.path.toLowerCase().includes(searchLower);
      
      const shouldShow = !searchTerm || nodeMatches || parentMatches;
      
      if (shouldShow) {
        items.push({ 
          ...node, 
          level,
          highlighted: nodeMatches && searchTerm
        });
      }
      
      if (node.type === 'folder' && node.children) {
        const shouldExpand = expandedNodes.has(node.path) || (searchTerm && nodeMatches);
        
        if (shouldExpand) {
          node.children.forEach(child => 
            traverse(child, level + 1, nodeMatches || parentMatches)
          );
        }
      }
    };
    
    if (node.children) {
      node.children.forEach(child => traverse(child, 0));
    }
    
    return items;
  }, [node, expandedNodes, searchTerm]);
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const endIndex = Math.min(startIndex + visibleCount + (bufferSize * 2), flattenedItems.length);
  const visibleItems = flattenedItems.slice(startIndex, endIndex);
  
  const toggleExpanded = useCallback((path) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);
  
  const handleItemClick = useCallback((item) => {
    if (item.type === 'folder') {
      toggleExpanded(item.path);
    } else {
      onFileSelected(item);
    }
  }, [toggleExpanded, onFileSelected]);
  
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop;
    setScrollTop(newScrollTop);
    
    // Debounce scroll events for better performance
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Optional: trigger any scroll-based optimizations here
    }, 100);
  }, []);
  
  // Auto-expand search results
  useEffect(() => {
    if (searchTerm) {
      const newExpanded = new Set(expandedNodes);
      flattenedItems.forEach(item => {
        if (item.type === 'folder' && item.highlighted) {
          newExpanded.add(item.path);
        }
      });
      setExpandedNodes(newExpanded);
    }
  }, [searchTerm, flattenedItems]);
  
  // Enhanced keyboard navigation with accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!keyboardNavActive || flattenedItems.length === 0) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => {
            const newIndex = Math.min(prev + 1, flattenedItems.length - 1);
            announceItem(flattenedItems[newIndex]);
            return newIndex;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => {
            const newIndex = Math.max(prev - 1, 0);
            announceItem(flattenedItems[newIndex]);
            return newIndex;
          });
          break;
        case 'ArrowRight':
          e.preventDefault();
          const currentItem = flattenedItems[focusedIndex];
          if (currentItem?.type === 'folder' && !expandedNodes.has(currentItem.path)) {
            toggleExpanded(currentItem.path);
            announceAction(`Expanded ${currentItem.name}`);
          } else if (currentItem?.type === 'file') {
            handleItemClick(currentItem);
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          const currentItemLeft = flattenedItems[focusedIndex];
          if (currentItemLeft?.type === 'folder' && expandedNodes.has(currentItemLeft.path)) {
            toggleExpanded(currentItemLeft.path);
            announceAction(`Collapsed ${currentItemLeft.name}`);
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          const selectedItem = flattenedItems[focusedIndex];
          if (selectedItem) {
            handleItemClick(selectedItem);
            if (selectedItem.type === 'file') {
              announceAction(`Selected file ${selectedItem.name}`);
            }
          }
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          announceItem(flattenedItems[0]);
          break;
        case 'End':
          e.preventDefault();
          const lastIndex = flattenedItems.length - 1;
          setFocusedIndex(lastIndex);
          announceItem(flattenedItems[lastIndex]);
          break;
        case 'Escape':
          setKeyboardNavActive(false);
          containerRef.current?.blur();
          announceAction('Exited tree navigation');
          break;
        case '*':
          e.preventDefault();
          const currentLevel = flattenedItems[focusedIndex]?.level || 0;
          const newExpanded = new Set(expandedNodes);
          flattenedItems.forEach(item => {
            if (item.type === 'folder' && item.level === currentLevel) {
              newExpanded.add(item.path);
            }
          });
          setExpandedNodes(newExpanded);
          announceAction('Expanded all folders at current level');
          break;
      }
    };
    
    if (keyboardNavActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [keyboardNavActive, focusedIndex, flattenedItems, expandedNodes, toggleExpanded, handleItemClick]);
  
  // Screen reader announcements
  const announceItem = (item) => {
    if (!item) return;
    const announcement = `${item.type === 'folder' ? 'Folder' : 'File'} ${item.name}${item.type === 'folder' ? (expandedNodes.has(item.path) ? ', expanded' : ', collapsed') : ''}`;
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  };
  
  const announceAction = (action) => {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'assertive');
    announcer.style.position = 'absolute';
    announcer.style.left = '-10000px';
    announcer.textContent = action;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  };
  
  // Auto-scroll focused item into view
  useEffect(() => {
    if (keyboardNavActive && containerRef.current) {
      const focusedItemTop = focusedIndex * itemHeight;
      const containerScrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight;
      
      if (focusedItemTop < containerScrollTop) {
        containerRef.current.scrollTop = focusedItemTop;
      } else if (focusedItemTop + itemHeight > containerScrollTop + containerHeight) {
        containerRef.current.scrollTop = focusedItemTop + itemHeight - containerHeight;
      }
    }
  }, [focusedIndex, keyboardNavActive]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div>
      {/* Performance stats and keyboard help */}
      <div style={{ marginBottom: '0.5rem' }}>
        {flattenedItems.length > 1000 && (
          <div style={{
            fontSize: '0.8rem',
            color: '#666',
            padding: '0.25rem 0.5rem',
            background: '#f8f9fa',
            borderRadius: '3px',
            marginBottom: '0.25rem'
          }}>
            📊 {flattenedItems.length} items • Showing {visibleItems.length} • Virtual scrolling active
          </div>
        )}
        <div style={{
          fontSize: '0.7rem',
          color: '#999',
          padding: '0.25rem 0.5rem',
          background: '#f9f9f9',
          borderRadius: '3px',
          border: '1px solid #eee'
        }}>
          ⌨️ Use arrow keys to navigate • Enter/Space to select • * to expand all • Esc to exit
        </div>
      </div>
      
      <div 
        ref={containerRef}
        tabIndex={0}
        role="tree"
        aria-label="File tree navigation"
        aria-activedescendant={keyboardNavActive ? `tree-item-${focusedIndex}` : undefined}
        aria-multiselectable="false"
        style={{ 
          height: maxHeight, 
          overflow: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          scrollbarWidth: 'thin',
          outline: keyboardNavActive ? '2px solid #007bff' : 'none'
        }}
        onScroll={handleScroll}
        onFocus={() => setKeyboardNavActive(true)}
        onBlur={() => setKeyboardNavActive(false)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            setKeyboardNavActive(true);
          }
        }}
      >
        <div style={{ 
          height: flattenedItems.length * itemHeight, 
          position: 'relative',
          minHeight: '100%'
        }}>
          <div style={{ 
            transform: `translateY(${startIndex * itemHeight}px)`,
            willChange: 'transform'
          }}>
            {visibleItems.map((item, index) => {
              const actualIndex = startIndex + index;
              return (
                <TreeItem
                  key={`${item.path}-${actualIndex}`}
                  item={item}
                  itemIndex={actualIndex}
                  isActive={item.type === 'file' && item.path === activeFilePath}
                  isExpanded={expandedNodes.has(item.path)}
                  isFocused={keyboardNavActive && actualIndex === focusedIndex}
                  onClick={() => handleItemClick(item)}
                  searchTerm={searchTerm}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const TreeItem = React.memo(({ item, isActive, isExpanded, isFocused, onClick, searchTerm, itemIndex }) => {
  const getIcon = () => {
    if (item.type === 'folder') {
      return isExpanded ? '📂' : '📁';
    }
    
    // File type icons
    const ext = item.name.toLowerCase().split('.').pop();
    const icons = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      txt: '📄', html: '🌐', xml: '🌐', jpg: '🖼️', png: '🖼️'
    };
    return icons[ext] || '📄';
  };
  
  const highlightText = (text, searchTerm) => {
    if (!searchTerm) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? 
        <mark key={index} style={{ background: '#ffeb3b', padding: '0 2px' }}>{part}</mark> : 
        part
    );
  };
  
  return (
    <div
      id={`tree-item-${itemIndex}`}
      className={`tree-item ${isActive ? 'active' : ''} ${item.type === 'folder' ? 'tree-folder' : 'tree-file'}`}
      role={item.type === 'folder' ? 'treeitem' : 'treeitem'}
      aria-expanded={item.type === 'folder' ? isExpanded : undefined}
      aria-selected={isActive}
      aria-level={item.level + 1}
      tabIndex={-1}
      onClick={onClick}
      style={{
        height: '28px',
        padding: '4px 8px',
        paddingLeft: `${8 + item.level * 20}px`,
        cursor: 'pointer',
        borderRadius: '4px',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: isActive ? '#e3f2fd' : 
                        isFocused ? '#f0f8ff' : 
                        item.highlighted ? '#fff3e0' : 'transparent',
        border: isFocused ? '1px solid #007bff' : '1px solid transparent',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        willChange: 'background-color'
      }}
      onMouseEnter={(e) => {
        if (!isActive && !item.highlighted && !isFocused) {
          e.target.style.backgroundColor = '#f5f5f5';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !item.highlighted && !isFocused) {
          e.target.style.backgroundColor = 'transparent';
        }
      }}
    >
      <span style={{ flexShrink: 0 }}>{getIcon()}</span>
      <span style={{ 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap',
        flex: 1
      }}>
        {highlightText(item.name, searchTerm)}
      </span>
      {item.type === 'folder' && item.children && (
        <span style={{ 
          fontSize: '0.7rem', 
          color: '#999', 
          flexShrink: 0,
          marginLeft: 'auto'
        }}>
          {item.children.length}
        </span>
      )}
    </div>
  );
});

export default VirtualizedTree;