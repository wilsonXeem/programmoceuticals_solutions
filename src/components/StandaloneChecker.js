import React, { useState } from 'react';
import { checkCeilingList } from '../utils/nafdacCeilingList';
import { checkFivePlusFivePolicy } from '../utils/fivePlusFivePolicy';
import { checkImportProhibitionList } from '../utils/importProhibitionList';
import { checkFDCRegulatoryDirective } from '../utils/fdcRegulatoryDirective';
import { hasNarrowTherapeuticIndex, getMatchedNTIDrugs } from '../utils/narrowTherapeuticIndex';

const StandaloneChecker = () => {
  const [genericName, setGenericName] = useState('');
  const [results, setResults] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkProduct = async () => {
    if (!genericName.trim()) return;
    
    setIsChecking(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const name = genericName.trim();
    
    const checkResults = {
      ceilingList: checkCeilingList(name, name),
      fivePlusFive: checkFivePlusFivePolicy(name, name),
      importProhibition: checkImportProhibitionList(name, name),
      fdcDirective: checkFDCRegulatoryDirective(name, [name]),
      ntiCheck: hasNarrowTherapeuticIndex(name, [name]),
      matchedNTIDrugs: getMatchedNTIDrugs(name, [name])
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
    if (results.ntiCheck) {
      return { status: 'BE REQUIRED', color: '#17a2b8', reason: 'Bioequivalence study required (NTI drug)' };
    }
    return { status: 'APPROVED', color: '#28a745', reason: 'No regulatory restrictions found' };
  };

  return (
    <div className="container">
      <div className="card">
        <h2>🔍 Generic Drug Regulatory Checker</h2>
        <p>Check if your generic drug is affected by NAFDAC regulatory restrictions</p>
        
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Generic Name *
            </label>
            <input
              type="text"
              placeholder="e.g., Paracetamol"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              className="standalone-input"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #ddd',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
          </div>
          
          <button
            onClick={checkProduct}
            disabled={!genericName.trim() || isChecking}
            className="standalone-button"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              background: (!genericName.trim() || isChecking) ? '#f8f9fa' : '#3498db',
              color: (!genericName.trim() || isChecking) ? '#666' : 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (!genericName.trim() || isChecking) ? 'not-allowed' : 'pointer'
            }}
          >
            {isChecking ? '🔍 Checking...' : '🔍 Check Generic'}
          </button>
        </div>

        {results && (
          <div style={{ marginTop: '2rem' }}>
            <div className="standalone-status" style={{
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
              <div className="standalone-result-card" style={{
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
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/UPDATED-NAFDAC-CEILING-LIST.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#3498db',
                      textDecoration: 'underline',
                      fontSize: '0.8rem'
                    }}
                  >
                    📋 View NAFDAC Ceiling List
                  </a>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="https://trade.gov.ng/en/custom-pages/prohibited-items-list-during-import" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#3498db',
                      textDecoration: 'underline',
                      fontSize: '0.8rem'
                    }}
                  >
                    📋 View Import Prohibition List
                  </a>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Note_To_Industry_2024/PRODUCTS-FOR-55-VALIDITY-POLICY.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#3498db',
                      textDecoration: 'underline',
                      fontSize: '0.8rem'
                    }}
                  >
                    📋 View 5+5 Policy List
                  </a>
                </div>
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
                <div style={{ marginTop: '0.5rem' }}>
                  <a 
                    href="https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulatory_Directive/new/NAFDAC-Regulatory-Directives-on-the-Discontinuation-of-Some-Fixed-Dose-Combination-FDCs-Drugs.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: '#3498db',
                      textDecoration: 'underline',
                      fontSize: '0.8rem'
                    }}
                  >
                    📋 View FDC Regulatory Directive
                  </a>
                </div>
              </div>

              <div style={{
                padding: '1rem',
                border: '2px solid',
                borderColor: results.ntiCheck ? '#17a2b8' : '#28a745',
                borderRadius: '8px',
                background: results.ntiCheck ? '#e7f3ff' : '#f8fff8'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: results.ntiCheck ? '#17a2b8' : '#28a745' }}>
                  {results.ntiCheck ? '⚠️' : '✅'} Narrow Therapeutic Index
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                  {results.ntiCheck 
                    ? `BE study required - Found ${results.matchedNTIDrugs.length} NTI match(es): ${results.matchedNTIDrugs.join(', ')}` 
                    : 'No NTI drugs found - Standard BE requirements apply'}
                </p>
                {results.ntiCheck && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a 
                      href="https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/Guidelines/DRUG-GUIDELINES/Guidelines-for-Registration-of-Pharmaceutical-Products-in-Nigeria.pdf" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: '#17a2b8',
                        textDecoration: 'underline',
                        fontSize: '0.8rem'
                      }}
                    >
                      📋 View NAFDAC NTI Guidelines
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StandaloneChecker;