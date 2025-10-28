import React, { createContext, useContext, useState, useEffect } from 'react';
import { dossierService } from '../services/dossierService';
import { backgroundProcessor } from '../services/backgroundProcessor';

const DossierContext = createContext();

export const DossierProvider = ({ children }) => {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCached = async () => {
      const cached = await dossierService.getCachedDossier();
      if (cached) {
        setDossier(cached);
        // Start background tasks after dossier loads
        backgroundProcessor.preloadComponents();
        backgroundProcessor.cleanupOldCache();
      }
    };
    loadCached();
  }, []);

  const uploadDossier = async (fileOrFiles, onProgress) => {
    setLoading(true);
    try {
      let dossierData;
      if (Array.isArray(fileOrFiles)) {
        // Folder upload
        dossierData = await dossierService.parseFolder(fileOrFiles, onProgress);
      } else {
        // ZIP file upload
        dossierData = await dossierService.parseZipFile(fileOrFiles, onProgress);
      }
      setDossier(dossierData);
      
      // Start background processing after successful upload
      if (dossierData?.root?.children) {
        const allFiles = [];
        const traverse = (node) => {
          if (node.type === 'file') allFiles.push(node);
          if (node.children) node.children.forEach(traverse);
        };
        dossierData.root.children.forEach(traverse);
        
        backgroundProcessor.indexFiles(allFiles);
        backgroundProcessor.warmCache(allFiles.slice(0, 20).map(f => f.path));
        backgroundProcessor.prepareReportData(dossierData);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const clearDossier = () => {
    dossierService.clearDossier();
    setDossier(null);
  };

  const getFileBlob = (path) => {
    return dossierService.getFileBlob(path);
  };

  return (
    <DossierContext.Provider value={{
      dossier,
      loading,
      uploadDossier,
      clearDossier,
      getFileBlob,
      backgroundStatus: backgroundProcessor.getStatus()
    }}>
      {children}
    </DossierContext.Provider>
  );
};

export const useDossier = () => {
  const context = useContext(DossierContext);
  if (!context) {
    throw new Error('useDossier must be used within a DossierProvider');
  }
  return context;
};