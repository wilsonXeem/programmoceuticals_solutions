import React, { useState } from 'react';
import { contentSearchService } from '../services/contentSearchService';

const ContentSearchDemo = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      const searchResults = await contentSearchService.quickSearch([searchTerm]);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDrugInfo = async () => {
    setLoading(true);
    try {
      const allFiles = await contentSearchService.getAllDossierFiles();
      const drugResults = await contentSearchService.searchForDrugInfo(allFiles, searchTerm);
      setResults(drugResults);
    } catch (error) {
      console.error('Drug search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchRegulatory = async () => {
    setLoading(true);
    try {
      const allFiles = await contentSearchService.getAllDossierFiles();
      const regResults = await contentSearchService.searchForRegulatoryRefs(allFiles);
      setResults(regResults);
    } catch (error) {
      console.error('Regulatory search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', margin: '1rem 0' }}>
      <h4>Content Search Demo</h4>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter search term..."
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
        <button onClick={handleSearch} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button onClick={searchDrugInfo} disabled={loading} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
          Search Drug Info
        </button>
        <button onClick={searchRegulatory} disabled={loading} style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
          Search Regulatory Refs
        </button>
      </div>

      {results.length > 0 && (
        <div>
          <h5>Search Results ({results.length} files found)</h5>
          {results.map((result, index) => (
            <div key={index} style={{ 
              border: '1px solid #eee', 
              padding: '0.5rem', 
              margin: '0.5rem 0',
              borderRadius: '4px',
              background: '#f9f9f9'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                📄 {result.filePath}
              </div>
              {result.matches.map((match, matchIndex) => (
                <div key={matchIndex} style={{ 
                  fontSize: '0.8rem', 
                  padding: '0.25rem',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '3px',
                  margin: '0.25rem 0'
                }}>
                  <strong>"{match.term}"</strong>: ...{match.context}...
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContentSearchDemo;