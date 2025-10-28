import React, { useState, useMemo } from 'react';

const countSubfolders = (node) => {
  if (!node.children) return 0;
  return node.children.filter(child => child.type === 'folder').length;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const DossierTree = ({ node, activeFilePath, onFileSelected, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);

  // Remove duplicates and sort children
  const uniqueChildren = useMemo(() => {
    if (!node.children) return [];
    
    const seen = new Set();
    return node.children
      .filter(child => {
        // Hide .DS_Store files
        if (child.name === '.DS_Store') return false;
        
        const key = `${child.type}-${child.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        // Folders first, then files
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [node.children]);

  const handleToggle = () => {
    if (node.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelected(node);
    }
  };

  const getIcon = () => {
    if (node.type === 'folder') {
      return isExpanded ? '📂' : '📁';
    }
    return '📄';
  };

  const isActive = node.type === 'file' && node.path === activeFilePath;

  return (
    <div>
      <div
        className={`tree-item ${isActive ? 'active' : ''} ${node.type === 'folder' ? 'tree-folder' : 'tree-file'}`}
        onClick={handleToggle}
        style={{
          padding: '4px 8px',
          paddingLeft: `${8 + level * 16}px`,
          cursor: 'pointer',
          borderRadius: '4px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: isActive ? '#e3f2fd' : 'transparent',
          borderLeft: level > 0 ? '1px solid #eee' : 'none'
        }}
      >
        {/* Expansion indicator for folders */}
        {node.type === 'folder' && node.children && node.children.length > 0 ? (
          <span style={{ 
            minWidth: '12px', 
            fontSize: '0.7rem', 
            color: '#666',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}>
            ▶
          </span>
        ) : (
          <span style={{ minWidth: '12px' }}></span>
        )}
        
        <span style={{ minWidth: '16px' }}>{getIcon()}</span>
        <span style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          fontWeight: isActive ? '500' : 'normal',
          flex: 1
        }}>
          {node.name}
        </span>
        {node.type === 'file' && node.size && (
          <span style={{ 
            fontSize: '0.7rem', 
            color: '#666', 
            marginLeft: '4px',
            minWidth: 'fit-content',
            background: '#f0f0f0',
            padding: '1px 4px',
            borderRadius: '2px'
          }}>
            {formatFileSize(node.size)}
          </span>
        )}
        {node.type === 'folder' && node.children && (
          <span style={{ 
            fontSize: '0.7rem', 
            color: '#999', 
            marginLeft: '4px',
            minWidth: 'fit-content'
          }}>
            ({countSubfolders(node)})
          </span>
        )}
      </div>
      
      {node.type === 'folder' && isExpanded && uniqueChildren.length > 0 && (
        <div>
          {uniqueChildren.map((child) => (
            <DossierTree
              key={`${child.type}-${child.path}`}
              node={child}
              activeFilePath={activeFilePath}
              onFileSelected={onFileSelected}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DossierTree;