import React, { useState } from 'react';
import { checkCeilingList } from '../utils/nafdacCeilingList';
import { checkFivePlusFivePolicy } from '../utils/fivePlusFivePolicy';
import { checkImportProhibitionList } from '../utils/importProhibitionList';
import { checkFDCRegulatoryDirective } from '../utils/fdcRegulatoryDirective';

const StandaloneChecker = () => {
  const [productName, setProductName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkProduct = async () => {
    if (!productName.trim()) return;
    
    setIsChecking(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const activeIngredients = activeIngredient.trim() ? [activeIngredient.trim()] : [];
    
    const checkResults = {
      ceilingList: checkCeilingList(productName.trim(), activeIngredients[0]),
      fivePlusFive: checkFivePlusFivePolicy(productName.trim(), activeIngredients[0]),
      importProhibition: checkImportProhibitionList(productName.trim(), activeIngredients[0]),
      fdcDirective: checkFDCRegulatoryDirective(productName.trim(), activeIngredients)
    };
    
    setResults(checkResults);
    setIsChecking(false);
  };

  const getOverallStatus = () => {
    if (!results) return null;
    
    if (results.ceilingList) {
      return { status: 'REJECTED', color: '#dc3545', reason: 'Product found on NAFDAC Ceiling List' };
    }
    if (results.importProhibition) {
      return { status: 'REJECTED', color: '#dc3545', reason: 'Product found on Import Prohibition List' };
    }
    if (results.fdcDirective) {
      return { status: 'REJECTED', color: '#dc3545', reason: 'Prohibited FDC combination' };
    }
    if (results.fivePlusFive) {
      return { status: 'CONDITIONAL', color: '#ffc107', reason: 'Local manufacturing only (5+5 Policy)' };
    }
    return { status: 'APPROVED', color: '#28a745', reason: 'No regulatory restrictions found' };
  };

  return (
    <div className="container">
      <div className="card">
        <h2>🔍 Product Regulatory Checker</h2>
        <p>Check if your product is affected by NAFDAC regulatory restrictions</p>
        
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Product Name (Generic Name) *
              </label>
              <input
                type="text"
                placeholder="e.g., Paracetamol Tablets"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Active Ingredient (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Paracetamol"
                value={activeIngredient}
                onChange={(e) => setActiveIngredient(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>
          </div>
          
          <button
            onClick={checkProduct}
            disabled={!productName.trim() || isChecking}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              background: (!productName.trim() || isChecking) ? '#f8f9fa' : '#3498db',
              color: (!productName.trim() || isChecking) ? '#666' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (!productName.trim() || isChecking) ? 'not-allowed' : 'pointer'
            }}
          >
            {isChecking ? '🔍 Checking...' : '🔍 Check Product'}
          </button>
        </div>

        {results && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{
              padding: '1.5rem',
              borderRadius: '12px',
              background: getOverallStatus().color,
              color: 'white',
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                {getOverallStatus().status}
              </h3>
              <p style={{ margin: 0, fontSize: '1rem' }}>
                {getOverallStatus().reason}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div style={{
                padding: '1rem',
                border: '2px solid',
                borderColor: results.ceilingList ? '#dc3545' : '#28a745',
                borderRadius: '8px',
                background: results.ceilingList ? '#fff5f5' : '#f8fff8'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: results.ceilingList ? '#dc3545' : '#28a745' }}>
                  {results.ceilingList ? '❌' : '✅'} NAFDAC Ceiling List
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {results.ceilingList ? 'Product found on ceiling list - Cannot be registered' : 'Product not on ceiling list'}
                </p>
              </div>

              <div style={{
                padding: '1rem',
                border: '2px solid',
                borderColor: results.importProhibition ? '#dc3545' : '#28a745',
                borderRadius: '8px',
                background: results.importProhibition ? '#fff5f5' : '#f8fff8'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: results.importProhibition ? '#dc3545' : '#28a745' }}>
                  {results.importProhibition ? '❌' : '✅'} Import Prohibition List
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {results.importProhibition ? 'Product found on import prohibition list' : 'Product not on import prohibition list'}
                </p>
              </div>

              <div style={{
                padding: '1rem',
                border: '2px solid',
                borderColor: results.fivePlusFive ? '#ffc107' : '#28a745',
                borderRadius: '8px',
                background: results.fivePlusFive ? '#fffbf0' : '#f8fff8'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: results.fivePlusFive ? '#856404' : '#28a745' }}>
                  {results.fivePlusFive ? '⚠️' : '✅'} 5+5 Policy List
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {results.fivePlusFive ? 'Product on 5+5 policy - Local manufacturing only' : 'Product not affected by 5+5 policy'}
                </p>
              </div>

              <div style={{
                padding: '1rem',
                border: '2px solid',
                borderColor: results.fdcDirective ? '#dc3545' : '#28a745',
                borderRadius: '8px',
                background: results.fdcDirective ? '#fff5f5' : '#f8fff8'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: results.fdcDirective ? '#dc3545' : '#28a745' }}>
                  {results.fdcDirective ? '❌' : '✅'} FDC Regulatory Directive
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {results.fdcDirective 
                    ? `Prohibited FDC combination: ${results.fdcDirective.combination}` 
                    : 'No prohibited FDC combinations found'}
                </p>
              </div>

              <div style={{
                padding: '1rem',
                border: '2px solid #6c757d',
                borderRadius: '8px',
                background: '#f8f9fa'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#6c757d' }}>
                  ℹ️ Narrow Therapeutic Index
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#6c757d' }}>
                  NTI checking has been disabled. Please manually verify BE requirements.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandaloneChecker;