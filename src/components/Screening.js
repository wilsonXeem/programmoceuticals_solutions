import React, { useState, useEffect } from 'react';
import { useDossier } from '../hooks/useDossier';
import { DOSSIER_CHECKLIST } from '../utils/checklist';
import { INTERNAL_SCREENING_CHECKLIST } from '../utils/internalChecklist';
import { reportService } from '../services/reportService';
import { productExtractionService } from '../services/productExtractionService';
import { checkCeilingList } from '../utils/nafdacCeilingList';
import { checkFivePlusFivePolicy } from '../utils/fivePlusFivePolicy';
import { checkImportProhibitionList } from '../utils/importProhibitionList';
import { checkFDCRegulatoryDirective } from '../utils/fdcRegulatoryDirective';
import { hasNarrowTherapeuticIndex, getMatchedNTIDrugs } from '../utils/narrowTherapeuticIndex';

import InlineFilePreview from './InlineFilePreview';

const Screening = () => {
  const { dossier } = useDossier();
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('internal');
  const [internalResponses, setInternalResponses] = useState(new Map());
  const [internalNotes, setInternalNotes] = useState(new Map());
  const [activePreview, setActivePreview] = useState(null);
  const [productInfo, setProductInfo] = useState(null);
  const [productCheckResults, setProductCheckResults] = useState(null);
  const [wordDocResults, setWordDocResults] = useState(null);

  const flattenFiles = (node, basePath = '') => {
    let files = [];
    if (node.type === 'file') {
      files.push({
        path: node.path,
        name: node.name,
        size: node.size || 0,
        type: node.name?.split('.').pop()?.toLowerCase() || '',
        fullPath: basePath + '/' + node.name
      });
    }
    if (node.children) {
      node.children.forEach(child => {
        const childPath = basePath + (node.name ? '/' + node.name : '');
        files = files.concat(flattenFiles(child, childPath));
      });
    }
    return files;
  };

  const calculateSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const maxLen = Math.max(s1.length, s2.length);
    return (maxLen - matrix[s2.length][s1.length]) / maxLen;
  };

  const extractKeyTerms = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2 && !['pdf', 'doc', 'docx', 'the', 'and', 'for', 'with', 'module'].includes(term));
  };

  const findBestMatch = (expectedPath, description, files) => {
    const expectedFileName = expectedPath.split('/').pop().replace(/\.[^/.]+$/, '');
    const descriptionTerms = extractKeyTerms(description);
    const pathTerms = extractKeyTerms(expectedFileName);
    const allExpectedTerms = [...new Set([...descriptionTerms, ...pathTerms])];
    
    let bestMatch = null;
    let bestScore = 0;
    let matchType = 'none';
    
    files.forEach(file => {
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const fullPath = file.fullPath;
      const fileTerms = extractKeyTerms(fileName + ' ' + fullPath);
      
      if (file.fullPath.toLowerCase() === expectedPath.toLowerCase()) {
        bestMatch = file;
        bestScore = 1.0;
        matchType = 'exact-path';
        return;
      }
      
      let termMatches = 0;
      let exactMatches = 0;
      
      allExpectedTerms.forEach(expectedTerm => {
        const hasExactMatch = fileTerms.some(fileTerm => fileTerm === expectedTerm);
        const hasFuzzyMatch = fileTerms.some(fileTerm => 
          calculateSimilarity(fileTerm, expectedTerm) > 0.85
        );
        
        if (hasExactMatch) {
          exactMatches++;
          termMatches++;
        } else if (hasFuzzyMatch) {
          termMatches += 0.8;
        }
      });
      
      if (allExpectedTerms.length > 0) {
        const semanticScore = termMatches / allExpectedTerms.length;
        const exactBonus = exactMatches / allExpectedTerms.length * 0.2;
        const finalScore = Math.min(semanticScore + exactBonus, 1.0);
        
        if (finalScore > bestScore && finalScore > 0.4) {
          bestMatch = file;
          bestScore = finalScore;
          matchType = exactMatches > 0 ? 'semantic-exact' : 'semantic-fuzzy';
        }
      }
      
      const fileNameSimilarity = calculateSimilarity(fileName, expectedFileName);
      if (fileNameSimilarity > bestScore && fileNameSimilarity > 0.7) {
        bestMatch = file;
        bestScore = fileNameSimilarity;
        matchType = 'filename-similar';
      }
      
      if (bestScore < 0.5) {
        const pathSimilarity = calculateSimilarity(fullPath.toLowerCase(), expectedPath.toLowerCase());
        if (pathSimilarity > bestScore && pathSimilarity > 0.6) {
          bestMatch = file;
          bestScore = pathSimilarity;
          matchType = 'path-similar';
        }
      }
    });
    
    return { file: bestMatch, score: bestScore, matchType };
  };

  const validateFile = (file, expectedPath) => {
    const issues = [];
    
    if (expectedPath.toLowerCase().endsWith('.pdf') && file.type !== 'pdf') {
      issues.push('Expected PDF file');
    }
    
    if (file.size === 0) {
      issues.push('File appears to be empty');
    } else if (file.size < 1024) {
      issues.push('File size suspiciously small');
    }
    
    return issues;
  };

  const runChecklist = async () => {
    if (!dossier) return;
    
    setIsRunning(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const allFiles = flattenFiles(dossier.root);
    
    const checkResults = DOSSIER_CHECKLIST.map(item => {
      const match = findBestMatch(item.path, item.desc, allFiles);
      const issues = match.file ? validateFile(match.file, item.path) : [];
      
      let status = '❌ Missing';
      let confidence = 0;
      let matchDetails = '';
      let warnings = [];
      let matchTypeDescription = '';
      
      if (match.file) {
        confidence = Math.round(match.score * 100);
        matchDetails = match.file.fullPath;
        status = '✅ Found';
        
        switch (match.matchType) {
          case 'exact-path':
            matchTypeDescription = 'Exact path match';
            break;
          case 'semantic-exact':
            matchTypeDescription = 'Key terms matched exactly';
            break;
          case 'semantic-fuzzy':
            matchTypeDescription = 'Similar terms found';
            break;
          case 'filename-similar':
            matchTypeDescription = 'Filename similarity';
            break;
          case 'path-similar':
            matchTypeDescription = 'Path structure similarity';
            break;
          default:
            matchTypeDescription = 'Match found';
        }
        
        if (match.score < 0.8) {
          warnings.push(`${confidence}% confidence`);
        }
        
        if (issues.length > 0) {
          warnings = warnings.concat(issues);
        }
      }
      
      return {
        path: item.path,
        description: item.desc,
        status,
        confidence,
        matchType: match.matchType,
        matchTypeDescription,
        matchedFile: matchDetails,
        warnings,
        fileSize: match.file?.size || 0
      };
    });
    
    setResults(checkResults);
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsRunning(false);
  };


  
  const generateInternalReport = () => {
    if (internalResponses.size === 0) {
      alert('Please answer at least one question before generating a report.');
      return;
    }
    
    try {
      const fileName = reportService.generateInternalReport(
        dossier.name, 
        internalResponses, 
        internalNotes, 
        INTERNAL_SCREENING_CHECKLIST
      );
      alert(`Internal review report generated successfully: ${fileName}`);
    } catch (error) {
      console.error('Error generating internal report:', error);
      alert('Error generating internal report. Please try again.');
    }
  };

  const handleInternalResponse = (questionId, response) => {
    setInternalResponses(prev => new Map(prev).set(questionId, response));
  };

  const handleInternalNote = (questionId, note) => {
    setInternalNotes(prev => new Map(prev).set(questionId, note));
  };

  const [productInputs, setProductInputs] = useState({ productName: '' });
  
  const checkWordDocuments = () => {
    if (!dossier) return;
    
    const allFiles = flattenFiles(dossier.root);
    const qosWordFiles = allFiles.filter(file => {
      const path = file.fullPath.toLowerCase();
      const name = file.name.toLowerCase();
      return ((path.includes('module 2') && path.includes('2.3')) || path.includes('qos')) && 
             (name.endsWith('.doc') || name.endsWith('.docx'));
    });
    const qisWordFiles = allFiles.filter(file => {
      const path = file.fullPath.toLowerCase();
      const name = file.name.toLowerCase();
      return ((path.includes('module 1') && path.includes('1.4.2')) || path.includes('qis')) && 
             (name.endsWith('.doc') || name.endsWith('.docx'));
    });
    
    const results = {
      qosWord: qosWordFiles.length > 0 ? qosWordFiles[0] : null,
      qisWord: qisWordFiles.length > 0 ? qisWordFiles[0] : null
    };
    
    setWordDocResults(results);
    
    // Auto-suggest response for question 7
    if (results.qosWord && results.qisWord) {
      handleInternalResponse(7, 'yes');
      handleInternalNote(7, `✅ APPROVED: Both QOS and QIS Word documents found. QOS: "${results.qosWord.name}", QIS: "${results.qisWord.name}"`);
    } else {
      const missing = [];
      if (!results.qosWord) missing.push('QOS');
      if (!results.qisWord) missing.push('QIS');
      handleInternalResponse(7, 'no');
      handleInternalNote(7, `❌ MISSING: ${missing.join(' and ')} Word document(s) not found. Both QOS and QIS must be provided in Word format.`);
    }
  };
  


  const checkProductCompliance = () => {
    if (!productInputs.productName) {
      handleInternalNote(2, '⚠️ Please enter generic name.');
      return;
    }
    
    const genericName = productInputs.productName.trim();
    const extractedInfo = {
      productName: genericName,
      activeIngredients: [genericName],
      strength: '',
      dosageForm: ''
    };
    
    setProductInfo(extractedInfo);
    
    // Check against all lists
    const results = {
      ceilingList: checkCeilingList(genericName, genericName),
      fivePlusFive: checkFivePlusFivePolicy(genericName, genericName),
      importProhibition: checkImportProhibitionList(genericName, genericName),
      fdcDirective: checkFDCRegulatoryDirective(genericName, [genericName]),
      ntiCheck: hasNarrowTherapeuticIndex(genericName, [genericName]),
      matchedNTIDrugs: getMatchedNTIDrugs(genericName, [genericName])
    };
    
    setProductCheckResults(results);
    
    // Auto-check Word documents for Question 7
    checkWordDocuments();
    
    // Auto-suggest response for question 2
    if (results.ceilingList) {
      handleInternalResponse(2, 'no');
      handleInternalNote(2, `❌ REJECTED: Generic "${genericName}" found on NAFDAC Ceiling List. Cannot be registered.`);
    } else if (results.importProhibition) {
      handleInternalResponse(2, 'no');
      handleInternalNote(2, `❌ REJECTED: Generic "${genericName}" found on Federal Government Import Prohibition List. Cannot be registered.`);
    } else if (results.fivePlusFive) {
      handleInternalResponse(2, 'partial');
      handleInternalNote(2, `⚠️ CONDITIONAL: Generic "${genericName}" is on 5+5 Policy list - can only be registered as locally manufactured.`);
    } else {
      handleInternalResponse(2, 'yes');
      handleInternalNote(2, `✅ APPROVED: Generic "${genericName}" not found on any prohibition lists. Good to proceed with registration.`);
    }
    
    // Auto-suggest response for question 3 (FDC Regulatory Directive)
    if (results.fdcDirective) {
      handleInternalResponse(3, 'no');
      handleInternalNote(3, `❌ REJECTED: Generic "${genericName}" contains prohibited FDC combination: "${results.fdcDirective.combination}". Registration discontinued per NAFDAC regulatory directive.`);
    } else {
      handleInternalResponse(3, 'yes');
      handleInternalNote(3, `✅ APPROVED: Generic "${genericName}" not found on FDC regulatory directive prohibition list. Good to proceed.`);
    }
    
    // Auto-suggest response for question 10 (NTI Check)
    if (results.ntiCheck) {
      handleInternalResponse(10, 'yes');
      handleInternalNote(10, `⚠️ BE STUDY REQUIRED: Generic "${genericName}" found on Narrow Therapeutic Index list. Matched drugs: ${results.matchedNTIDrugs.join(', ')}. Bioequivalence study is mandatory.`);
    } else {
      handleInternalResponse(10, 'no');
      handleInternalNote(10, `✅ STANDARD BE: Generic "${genericName}" not found on NTI list. Standard bioequivalence requirements apply.`);
    }
  };

  const getInternalSummary = () => {
    const completenessItems = INTERNAL_SCREENING_CHECKLIST.filter(item => !item.excludeFromCompleteness);
    const total = completenessItems.length;
    const completenessResponses = new Map();
    completenessItems.forEach(item => {
      if (internalResponses.has(item.id)) {
        completenessResponses.set(item.id, internalResponses.get(item.id));
      }
    });
    const answered = completenessResponses.size;
    const yesCount = Array.from(completenessResponses.values()).filter(r => r === 'yes').length;
    const noCount = Array.from(completenessResponses.values()).filter(r => r === 'no').length;
    const partialCount = Array.from(completenessResponses.values()).filter(r => r === 'partial').length;
    
    return { total, answered, yesCount, noCount, partialCount };
  };

  const findModuleFoldersForQuestion = (questionId, moduleRef) => {
    if (!dossier) return { found: [], required: 0 };
    
    const findFoldersRecursively = (node, path = '') => {
      let folders = [];
      if (node.type === 'folder') {
        folders.push({ ...node, fullPath: path + '/' + node.name });
      }
      if (node.children) {
        node.children.forEach(child => {
          const childPath = path + (node.name ? '/' + node.name : '');
          folders = folders.concat(findFoldersRecursively(child, childPath));
        });
      }
      return folders;
    };
    
    const allFolders = findFoldersRecursively(dossier.root);
    
    // Question-specific search patterns with required counts
    switch(questionId) {
      case 1: { // Module 1 / 3.2.P.1 / 3.2.P.3.1 (3 required)
        const patterns = [
          ['module 1', 'module1'],
          ['3.2.p.1', '32p1'],
          ['3.2.p.3.1', '32p31']
        ];
        const found = patterns.filter(patternGroup => 
          allFolders.some(folder => 
            patternGroup.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        );
        return { found: found.map(p => p[0]), required: 3 };
      }
        
      case 4: { // Module 1.2.15 / 3.2.S.4.4 (2 required)
        const patterns = [
          ['1.2.15', '1215'],
          ['3.2.s.4.4', '32s44']
        ];
        const found = patterns.filter(patternGroup => 
          allFolders.some(folder => 
            patternGroup.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        );
        return { found: found.map(p => p[0]), required: 2 };
      }
        
      case 5: { // Module 1.3.1 (1 required)
        const hasFolder = allFolders.some(folder => {
          const path = folder.fullPath.toLowerCase();
          return path.includes('1.3.1') || path.includes('131');
        });
        return { found: hasFolder ? ['1.3.1'] : [], required: 1 };
      }
        
      case 7: { // Module 2.3 / 1.4.2 (2 required)
        const patterns = [
          ['2.3', 'module 2'],
          ['1.4.2', '142']
        ];
        const found = patterns.filter(patternGroup => 
          allFolders.some(folder => 
            patternGroup.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        );
        return { found: found.map(p => p[0]), required: 2 };
      }
        
      case 6: { // Modules 1-5 + Module 3 S/P/R parts (8 required)
        const modulePatterns = [
          { name: 'Module 1', patterns: ['module 1', 'module1'] },
          { name: 'Module 2', patterns: ['module 2', 'module2'] },
          { name: 'Module 3', patterns: ['module 3', 'module3'] },
          { name: 'Module 4', patterns: ['module 4', 'module4'] },
          { name: 'Module 5', patterns: ['module 5', 'module5'] },
          { name: 'S-part', patterns: ['3.2.s', '32s', 'drug substance'] },
          { name: 'P-part', patterns: ['3.2.p', '32p', 'drug product'] },
          { name: 'R-part', patterns: ['3.2.r', '32r', 'regional information'] }
        ];
        
        const found = modulePatterns.filter(modulePattern => 
          allFolders.some(folder => 
            modulePattern.patterns.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        ).map(mp => mp.name);
        
        return { found: found, required: 8, details: found };
      }
        
      case 8: { // Module 3.2.P.5.1 (1 required)
        const hasFolder = allFolders.some(folder => {
          const path = folder.fullPath.toLowerCase();
          return (path.includes('module 3') && (path.includes('3.2.p.5.1') || path.includes('32p51'))) || path.includes('specification');
        });
        return { found: hasFolder ? ['Module 3.2.P.5.1'] : [], required: 1 };
      }
        
      case 9: { // Modules 1, 2, and 5 + BE/BW details
        const modulePatterns = [
          { name: 'Module 1', patterns: ['module 1', 'module1'] },
          { name: 'Module 2', patterns: ['module 2', 'module2'] },
          { name: 'Module 5', patterns: ['module 5', 'module5'] }
        ];
        
        const found = modulePatterns.filter(modulePattern => 
          allFolders.some(folder => 
            modulePattern.patterns.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        ).map(mp => mp.name);
        
        // Additional BE/BW specific checks
        const allFiles = flattenFiles(dossier.root);
        const module5Files = allFiles.filter(file => {
          const path = file.fullPath.toLowerCase();
          return path.includes('module 5') && path.includes('5.3');
        });
        
        const btifBafFiles = allFiles.filter(file => {
          const path = file.fullPath.toLowerCase();
          const name = file.name.toLowerCase();
          const isWordDoc = name.endsWith('.doc') || name.endsWith('.docx');
          const inModule141 = path.includes('module 1') && (path.includes('1.4.1') || path.includes('1.04.1') || path.includes('1.4.01'));
          return isWordDoc && inModule141;
        });
        
        return { 
          found: found, 
          required: 3,
          details: {
            module5Files: module5Files.length,
            btifBafFiles: btifBafFiles.length,
            module5FileNames: module5Files.map(f => f.name),
            btifBafFileNames: btifBafFiles.map(f => f.name)
          }
        };
      }
        
      case 11: { // 3.2.P.2 / 3.2.P.5.4 / 3.2.P.8.3 / 3.2.R.1 (4 required)
        const patterns = [
          ['3.2.p.2', '32p2'],
          ['3.2.p.5.4', '32p54'],
          ['3.2.p.8.3', '32p83'],
          ['3.2.r.1', '32r1']
        ];
        const found = patterns.filter(patternGroup => 
          allFolders.some(folder => 
            patternGroup.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        );
        return { found: found.map(p => p[0]), required: 4 };
      }
        
      case 12: { // Module 3.2.R.1 (all subsections)
        const hasR1 = allFolders.some(folder => {
          const path = folder.fullPath.toLowerCase();
          return path.includes('3.2.r.1') || path.includes('32r1');
        });
        return { found: hasR1 ? ['3.2.R.1'] : [], required: 1 };
      }
        
      case 13: { // Module 3.2.R.1.2 (1 required)
        const hasFolder = allFolders.some(folder => {
          const path = folder.fullPath.toLowerCase();
          return path.includes('3.2.r.1.2') || path.includes('32r12') || path.includes('master production');
        });
        return { found: hasFolder ? ['3.2.R.1.2'] : [], required: 1 };
      }
        
      case 14: { // Module 3.2.P.2 / 5.3.1.2 (2 required)
        const patterns = [
          ['3.2.p.2', '32p2'],
          ['5.3.1.2', '5312', 'module 5']
        ];
        const found = patterns.filter(patternGroup => 
          allFolders.some(folder => 
            patternGroup.some(pattern => folder.fullPath.toLowerCase().includes(pattern))
          )
        );
        return { found: found.map(p => p[0]), required: 2 };
      }
        
      case 15: { // Module 3.2.P.8.3 (1 required)
        const hasFolder = allFolders.some(folder => {
          const path = folder.fullPath.toLowerCase();
          return path.includes('3.2.p.8.3') || path.includes('32p83');
        });
        return { found: hasFolder ? ['3.2.P.8.3'] : [], required: 1 };
      }
        
      default: {
        const modulePatterns = moduleRef.split('/').map(m => m.trim());
        const foundFolders = allFolders.filter(folder => {
          const path = folder.fullPath.toLowerCase();
          return modulePatterns.some(pattern => path.includes(pattern.toLowerCase()));
        });
        return { found: foundFolders.map(f => f.name), required: modulePatterns.length };
      }
    }
  };

  const findModuleFiles = (moduleRef) => {
    if (!dossier) return [];
    
    const allFiles = flattenFiles(dossier.root);
    
    // Special handling for question 1 - Module 1/1.3.1 and Module 3/3.2.P.1 and 3.2.P.3.1
    if (moduleRef === 'Module 1 / 3.2.P.1 / 3.2.P.3.1') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // Check if in Module 1 section 1.3.1 (handle zero-padding)
        const inModule1_131 = filePath.includes('module 1') && (filePath.includes('1.3.1') || filePath.includes('1.03.1') || filePath.includes('1.3.01'));
        
        // Check if in Module 3 sections 3.2.P.1 or 3.2.P.3.1
        const inModule3_32P1 = filePath.includes('module 3') && filePath.includes('3.2.p.1');
        const inModule3_32P31 = filePath.includes('module 3') && filePath.includes('3.2.p.3.1');
        
        return isPdf && notMacOSX && (inModule1_131 || inModule3_32P1 || inModule3_32P31);
      });
    }
    
    // Special handling for Question 4 - Module 1.2.15 and 3.2.S.4.4
    if (moduleRef === 'Module 1.2.15 / 3.2.S.4.4') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // Check if in Module 1 section 1.2.15 (handle zero-padding)
        const inModule1_1215 = filePath.includes('module 1') && (filePath.includes('1.2.15') || filePath.includes('1215') || filePath.includes('1.2.015'));
        
        // Check if in Module 3 section 3.2.S.4.4
        const inModule3_32S44 = filePath.includes('module 3') && (filePath.includes('3.2.s.4.4') || filePath.includes('32s44'));
        
        return isPdf && notMacOSX && (inModule1_1215 || inModule3_32S44);
      });
    }
    
    // Special handling for Question 7 - Only PDFs for QOS and QIS review
    if (moduleRef === 'Module 2.3 / 1.4.2') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const fileName = file.name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // Check if in Module 2 section 2.3 (QOS)
        const inModule2_23 = (filePath.includes('module 2') && filePath.includes('2.3')) || filePath.includes('qos');
        
        // Check if in Module 1 section 1.4.2 (QIS)
        const inModule1_142 = (filePath.includes('module 1') && filePath.includes('1.4.2')) || filePath.includes('qis');
        
        return isPdf && notMacOSX && (inModule2_23 || inModule1_142);
      });
    }
    
    // Special handling for Question 8 - Module 3.2.P.5.1 FPP specifications
    if (moduleRef === 'Module 3.2.P.5.1') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // Strict check for Module 3 section 3.2.P.5.1 only
        const inModule3_32P51 = filePath.includes('module 3') && (filePath.includes('3.2.p.5.1') || filePath.includes('32p51'));
        
        return isPdf && notMacOSX && inModule3_32P51;
      });
    }
    
    // Special handling for Question 9 - BE/BW data and BTIF/BAF documents
    if (moduleRef === 'Module 5 / Module 1-2') {
      const beFiles = allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const fileName = file.name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // BE/BW data in Module 5.3 only
        const inModule53 = filePath.includes('module 5') && filePath.includes('5.3');
        
        return isPdf && notMacOSX && inModule53;
      });
      
      const btifBafFiles = allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const fileName = file.name.toLowerCase();
        const isWordDoc = fileName.endsWith('.doc') || fileName.endsWith('.docx');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // BTIF in Module 1.4.1 (handle zero-padding)
        const inModule141 = filePath.includes('module 1') && (filePath.includes('1.4.1') || filePath.includes('1.04.1') || filePath.includes('1.4.01'));
        
        return isWordDoc && notMacOSX && inModule141;
      });
      
      const biowaiverFiles = allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        // Biowaiver modules 1.2.17 and 1.2.18 (handle zero-padding)
        const inModule1217 = filePath.includes('module 1') && (filePath.includes('1.2.17') || filePath.includes('1.02.17') || filePath.includes('1.2.017'));
        const inModule1218 = filePath.includes('module 1') && (filePath.includes('1.2.18') || filePath.includes('1.02.18') || filePath.includes('1.2.018'));
        
        return isPdf && notMacOSX && (inModule1217 || inModule1218);
      });
      
      return [...beFiles, ...btifBafFiles, ...biowaiverFiles];
    }
    
    // Special handling for Question 2 - only SmPC files from Module 1.3.1
    if (moduleRef === 'Module 1.3.1') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        const inModule1_131 = filePath.includes('module 1') && (filePath.includes('1.3.1') || filePath.includes('1.03.1') || filePath.includes('1.3.01'));
        return isPdf && notMacOSX && inModule1_131;
      });
    }
    
    // Special handling for Question 12 & 13 - all files under 3.2.R.1
    if (moduleRef === 'Module 3.2.R.1.1 / 3.2.R.1.2' || moduleRef === 'Module 3.2.R.1.2') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        const inModule3_R1 = filePath.includes('module 3') && (filePath.includes('3.2.r.1') || filePath.includes('32r1'));
        return isPdf && notMacOSX && inModule3_R1;
      });
    }
    
    // Special handling for Question 14 - 3.2.P.2 and Module 5.3 variants
    if (moduleRef === 'Module 3.2.P.2 / 5.3.1.2') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        
        const inModule3_P2 = filePath.includes('module 3') && filePath.includes('3.2.p.2');
        const inModule5_53 = filePath.includes('module 5') && (filePath.includes('5.3.1.2') || filePath.includes('5.3.1') || filePath.includes('5.3'));
        
        return isPdf && notMacOSX && (inModule3_P2 || inModule5_53);
      });
    }
    
    // Special handling for Question 15 - 3.2.P.8.3 stability data
    if (moduleRef === 'Module 3.2.P.8.3') {
      return allFiles.filter(file => {
        const filePath = file.fullPath.toLowerCase();
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
        const inModule3_P83 = filePath.includes('module 3') && (filePath.includes('3.2.p.8.3') || filePath.includes('32p83'));
        return isPdf && notMacOSX && inModule3_P83;
      });
    }
    
    const modulePatterns = moduleRef.toLowerCase().split('/').map(m => m.trim());
    
    return allFiles.filter(file => {
      const filePath = file.fullPath.toLowerCase();
      const fileName = file.name.toLowerCase();
      const isPdf = fileName.endsWith('.pdf');
      const notMacOSX = !filePath.includes('__macosx') && !file.name.startsWith('._');
      
      if (!isPdf || !notMacOSX) return false;
      
      return modulePatterns.some(pattern => {
        if (pattern === 'general' || pattern === 'pre-screening' || pattern === 'final decision') {
          return true;
        }
        
        if (pattern.startsWith('module')) {
          const moduleNum = pattern.replace(/[^0-9.]/g, '');
          return filePath.includes(`module ${moduleNum}`) || filePath.includes(`module${moduleNum}`);
        }
        
        if (pattern.includes('.')) {
          const dotPattern = pattern.replace(/\./g, '.');
          const noDotPattern = pattern.replace(/\./g, '');
          const slashPattern = pattern.replace(/\./g, '/');
          const dashPattern = pattern.replace(/\./g, '-');
          
          // Handle zero-padded versions (e.g., 1.2.01 for 1.2.1)
          const zeroPaddedPattern = pattern.replace(/(\d+)(?=\.|$)/g, (match) => {
            return match.length === 1 ? '0' + match : match;
          });
          
          return filePath.includes(dotPattern) || filePath.includes(noDotPattern) || 
                 filePath.includes(slashPattern) || filePath.includes(dashPattern) ||
                 filePath.includes(zeroPaddedPattern) || filePath.includes(zeroPaddedPattern.replace(/\./g, ''));
        }
        
        return filePath.includes(pattern) || fileName.includes(pattern);
      });
    });
  };

  const getModuleStatus = (moduleRef, questionId) => {
    const result = findModuleFoldersForQuestion(questionId, moduleRef);
    const foundCount = result.found.length;
    const requiredCount = result.required;
    
    let status = 'Missing';
    if (foundCount === requiredCount) {
      status = 'Complete';
    } else if (foundCount > 0) {
      status = 'Incomplete';
    }
    
    return {
      status: status,
      found: foundCount > 0,
      count: foundCount,
      required: requiredCount,
      folders: result.found
    };
  };

  const navigateToModule = (moduleRef) => {
    window.location.href = '/review';
  };

  const openInlinePreview = (questionId, moduleRefs, title) => {
    // Close any existing preview first
    setActivePreview(null);
    
    // Small delay to ensure cleanup
    setTimeout(() => {
      const files = findModuleFiles(moduleRefs);
      const documents = [{
        moduleRef: moduleRefs,
        filePath: files.length > 0 ? files[0].path : '',
        files: files
      }];
      
      setActivePreview({
        questionId,
        title,
        documents
      });
    }, 100);
  };

  const previewModuleFiles = (moduleRef) => {
    const files = findModuleFiles(moduleRef);
    if (files.length > 0) {
      const documents = [{
        moduleRef: moduleRef,
        filePath: files[0].path,
        files: files
      }];
      
      setPreviewData({
        title: `Preview: ${moduleRef}`,
        documents
      });
      setShowInlinePreview(true);
    } else {
      alert(`No files found for ${moduleRef}`);
    }
  };



  if (!dossier) {
    return (
      <div className="container">
        <div className="card">
          <h2>Dossier Screening</h2>
          <p>No dossier loaded. Please upload a dossier first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 'none', width: '100%' }}>
      <div className="card" style={{ width: '100%', maxWidth: 'none' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #3498db, #2c3e50)',
          borderRadius: '12px',
          color: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '700' }}>🔍 Dossier Screening</h2>
          <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1rem' }}>NAFDAC Regulatory Compliance Assessment</p>
        </div>
        
        {false && (
          <div>
            <p>Run the checklist to verify required documents are present in your dossier.</p>
            <div style={{ marginBottom: '1rem' }}>
              <button 
                className="btn" 
                onClick={runChecklist}
                disabled={isRunning}
              >
                {isRunning ? 'Running Checklist...' : 'Run Checklist'}
              </button>
              

            </div>

            {isRunning && (
              <div style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>🔍 Running Checklist...</div>
                <div style={{ 
                  width: '100%', 
                  height: '4px', 
                  background: '#e9ecef', 
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #3498db, #2980b9)',
                    animation: 'loading 1.5s ease-in-out infinite'
                  }}></div>
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem' }}>
                  Analyzing {DOSSIER_CHECKLIST.length} required documents...
                </div>
              </div>
            )}

            {results.length > 0 && !isRunning && (
              <div style={{ marginTop: '2rem' }}>
                <h3>Screening Results</h3>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Required Document</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Matched File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item, index) => (
                      <tr key={index}>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {item.path}
                        </td>
                        <td>{item.description}</td>
                        <td className={
                          item.status.includes('✅') ? 'status-present' : 'status-missing'
                        }>
                          {item.status}
                        </td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {item.matchedFile || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <strong>Document Status:</strong>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        <div>✅ Found: {results.filter(r => r.status.includes('✅')).length}</div>
                        <div>❌ Missing: {results.filter(r => r.status.includes('❌')).length}</div>
                        <div>Total: {results.length}</div>
                      </div>
                    </div>
                    <div>
                      <strong>Compliance Analysis:</strong>
                      <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        <div>Compliance Rate: {((results.filter(r => r.status.includes('✅')).length / results.length) * 100).toFixed(1)}%</div>
                        <div>High Confidence: {((results.filter(r => r.confidence >= 80).length / results.length) * 100).toFixed(1)}%</div>
                        <div>Avg Match Score: {results.length > 0 ? (results.reduce((sum, r) => sum + r.confidence, 0) / results.length).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  </div>
                  {results.filter(r => r.status.includes('❌')).length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <strong>Missing Files:</strong>
                      <div style={{ 
                        fontSize: '0.8rem', 
                        marginTop: '0.5rem',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        padding: '0.5rem',
                        background: '#fff',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px'
                      }}>
                        {results.filter(r => r.status.includes('❌')).map((item, index) => (
                          <div key={index} style={{ 
                            marginBottom: '0.25rem',
                            padding: '0.25rem',
                            background: '#fff5f5',
                            borderLeft: '3px solid #dc3545',
                            paddingLeft: '0.5rem'
                          }}>
                            <div style={{ fontWeight: '500', color: '#721c24' }}>{item.description}</div>
                            <div style={{ color: '#666', fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.path}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '0.5rem 1rem', 
                      borderRadius: '20px', 
                      background: 
                        results.filter(r => r.status.includes('✅')).length === results.length ? '#28a745' :
                        results.filter(r => r.status.includes('✅')).length >= results.length * 0.8 ? '#ffc107' : '#dc3545',
                      color: 'white',
                      fontSize: '0.9rem',
                      fontWeight: 'bold'
                    }}>
                      {
                        results.filter(r => r.status.includes('✅')).length === results.length ? 'COMPLETE' :
                        results.filter(r => r.status.includes('✅')).length >= results.length * 0.8 ? 'MOSTLY COMPLETE' : 'INCOMPLETE'
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {true && (
          <div>
              <p>Screening checklist for NAFDAC reviewers to assess dossier compliance and completeness.</p>
            
              {/* Product Information Input - Required for Questions 2, 3, and 10 */}
              <div style={{ 
                background: '#f8f9fa', 
                padding: '1.5rem', 
                borderRadius: '12px', 
                border: '2px solid #e9ecef',
                marginBottom: '2rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#2c3e50', fontSize: '1.1rem', fontWeight: '600' }}>
                  📋 Generic Name (Required First)
                </h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
                  Enter generic name below. This information will be used for Questions 2, 3, and 10.
                </p>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Generic Name:</label>
                  <input
                    type="text"
                    placeholder="e.g., Paracetamol"
                    value={productInputs.productName}
                    onChange={(e) => setProductInputs(prev => ({ ...prev, productName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <button
                  onClick={checkProductCompliance}
                  disabled={!productInputs.productName}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    background: !productInputs.productName ? '#f8f9fa' : '#3498db',
                    color: !productInputs.productName ? '#666' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: !productInputs.productName ? 'not-allowed' : 'pointer'
                  }}
                >
                  🔍 Check Product Compliance
                </button>
                {productCheckResults && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'white', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Compliance Check Results:</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      <div>Ceiling List: {productCheckResults.ceilingList ? '❌ Found (Prohibited)' : '✅ Clear'}</div>
                      <div>Import Prohibition: {productCheckResults.importProhibition ? '❌ Found (Prohibited)' : '✅ Clear'}</div>
                      <div>5+5 Policy: {productCheckResults.fivePlusFive ? '⚠️ Found (Local only)' : '✅ Clear'}</div>
                      <div>FDC Directive: {productCheckResults.fdcDirective ? '❌ Found (Prohibited)' : '✅ Clear'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <button 
                  className="btn" 
                  onClick={generateInternalReport}
                  disabled={internalResponses.size === 0}
                  style={{
                    background: internalResponses.size === 0 ? '#f8f9fa' : '#28a745',
                    color: internalResponses.size === 0 ? '#666' : 'white',
                    cursor: internalResponses.size === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  📄 Generate Screening Report
                </button>
                {internalResponses.size === 0 && (
                  <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}>
                    Answer questions to enable report generation
                  </span>
                )}
              </div>
                <div style={{ marginBottom: '2rem' }}>
                  {INTERNAL_SCREENING_CHECKLIST.map((item) => {
                const response = internalResponses.get(item.id);
                const note = internalNotes.get(item.id) || '';
                // Special handling for Question 2 and 6
                let moduleStatus;
                if (item.id === 6) {
                  // Check general checklist completion
                  const totalDocs = results.length;
                  const foundDocs = results.filter(r => r.status.includes('✅')).length;
                  const complianceRate = totalDocs > 0 ? (foundDocs / totalDocs) * 100 : 0;
                  
                  if (complianceRate >= 90) {
                    moduleStatus = { status: 'Complete', found: true, count: foundDocs, required: totalDocs, type: 'checklist' };
                  } else if (complianceRate >= 70) {
                    moduleStatus = { status: 'Mostly Complete', found: true, count: foundDocs, required: totalDocs, type: 'checklist' };
                  } else {
                    moduleStatus = { status: 'Incomplete', found: false, count: foundDocs, required: totalDocs, type: 'checklist' };
                  }
                } else if (item.id === 2) {
                  if (productCheckResults) {
                    const hasIssues = productCheckResults.ceilingList || productCheckResults.importProhibition;
                    if (hasIssues) {
                      moduleStatus = { status: 'Rejected', found: true, count: 1, type: 'compliance' };
                    } else if (productCheckResults.fivePlusFive) {
                      moduleStatus = { status: 'Conditional', found: true, count: 1, type: 'compliance' };
                    } else {
                      moduleStatus = { status: 'Approved', found: true, count: 1, type: 'compliance' };
                    }
                  } else {
                    moduleStatus = { status: 'Check Required', found: false, count: 0, type: 'compliance' };
                  }
                } else {
                  moduleStatus = item.moduleRef !== 'General / Pre-screening' ? getModuleStatus(item.moduleRef, item.id) : { found: false, count: 0, type: 'none' };
                }
                
                return (
                  <div key={item.id} style={{
                    border: '2px solid',
                    borderColor: response === 'yes' ? '#28a745' : response === 'no' ? '#dc3545' : response === 'partial' ? '#ffc107' : '#e9ecef',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem',
                    background: response === 'yes' ? '#f8fff8' : response === 'no' ? '#fff8f8' : response === 'partial' ? '#fffbf0' : 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease'
                  }}>
                    {activePreview && activePreview.questionId === item.id ? (
                      <InlineFilePreview
                        documents={activePreview.documents}
                        title={activePreview.title}
                        onClose={() => setActivePreview(null)}
                      />
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ 
                              margin: '0 0 0.75rem 0', 
                              color: '#2c3e50',
                              fontSize: '1.1rem',
                              fontWeight: '600',
                              lineHeight: '1.4'
                            }}>
                              <span style={{
                                background: '#3498db',
                                color: 'white',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                marginRight: '0.75rem'
                              }}>
                                Q{item.id}
                              </span>
                              {item.question}
                            </h4>
                            <div style={{ 
                              margin: '0 0 0.75rem 0', 
                              padding: '0.5rem 0.75rem',
                              background: '#f8f9fa',
                              borderRadius: '6px',
                              fontSize: '0.85rem'
                            }}>
                              <span style={{ color: '#495057', fontWeight: '600' }}>Section:</span>
                              <span style={{ color: '#6c757d', marginLeft: '0.5rem' }}>{item.section}</span>
                            </div>
                            <div style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <strong>Module Reference:</strong> 
                              {item.moduleRef !== 'General / Pre-screening' && item.moduleRef !== 'Final Decision' && item.moduleRef !== 'General Checklist' ? (
                                <button
                                  onClick={() => openInlinePreview(
                                    item.id, 
                                    item.moduleRef, 
                                    `Question ${item.id}: ${item.question}`
                                  )}
                                  style={{
                                    background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.4rem 1rem',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    boxShadow: '0 2px 4px rgba(52, 152, 219, 0.3)',
                                    transition: 'all 0.2s ease'
                                  }}
                                  title={`Preview documents for ${item.moduleRef}`}
                                >
                                  📄 View Files ({item.moduleRef})
                                </button>
                              ) : (
                                <span style={{ color: '#666' }}>{item.moduleRef}</span>
                              )}
                              {item.moduleRef !== 'General / Pre-screening' && item.moduleRef !== 'General Checklist' && item.id !== 16 && item.id !== 20 && (
                                <span style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  background: 
                                    moduleStatus.status === 'Complete' || moduleStatus.status === 'Approved' ? '#d4edda' :
                                    moduleStatus.status === 'Incomplete' || moduleStatus.status === 'Conditional' ? '#fff3cd' : 
                                    moduleStatus.status === 'Rejected' ? '#f8d7da' :
                                    moduleStatus.status === 'Check Required' ? '#e2e3e5' : '#f8d7da',
                                  color: 
                                    moduleStatus.status === 'Complete' || moduleStatus.status === 'Approved' ? '#155724' :
                                    moduleStatus.status === 'Incomplete' || moduleStatus.status === 'Conditional' ? '#856404' : 
                                    moduleStatus.status === 'Rejected' ? '#721c24' :
                                    moduleStatus.status === 'Check Required' ? '#6c757d' : '#721c24'
                                }}>
                                  {moduleStatus.status}
                                  {item.id === 6 && moduleStatus.folders && moduleStatus.folders.length > 0 && (
                                    <div style={{ fontSize: '0.6rem', marginTop: '0.2rem', opacity: 0.8 }}>
                                      Found: {moduleStatus.folders.join(', ')}
                                    </div>
                                  )}
                                  {item.id === 2 && productInfo && (
                                    <div style={{ fontSize: '0.6rem', marginTop: '0.2rem', opacity: 0.8 }}>
                                      {productInfo.productName}
                                    </div>
                                  )}
                                  {item.id === 9 && moduleStatus.details && (
                                    <div style={{ fontSize: '0.6rem', marginTop: '0.2rem', opacity: 0.8 }}>
                                      Module 5: {moduleStatus.details.module5Files} files | BTIF/BAF: {moduleStatus.details.btifBafFiles} files
                                    </div>
                                  )}
                                </span>
                              )}
                            </div>
                            <p style={{ margin: '0', fontSize: '0.9rem', color: '#555', fontStyle: 'italic' }}>
                              {item.guide}
                              {item.checkCeilingList && (
                                <span>
                                  {' '}
                                  <button
                                    onClick={() => window.open('https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/UPDATED-NAFDAC-CEILING-LIST.pdf', '_blank')}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3498db',
                                      textDecoration: 'underline',
                                      fontSize: '0.9rem',
                                      fontStyle: 'normal',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                    title="View NAFDAC ceiling list"
                                  >
                                    NAFDAC ceiling list
                                  </button>
                                  {' | '}
                                  <button
                                    onClick={() => window.open('https://trade.gov.ng/en/custom-pages/prohibited-items-list-during-import', '_blank')}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3498db',
                                      textDecoration: 'underline',
                                      fontSize: '0.9rem',
                                      fontStyle: 'normal',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                    title="View Federal Government Import Prohibition List"
                                  >
                                    Import prohibition list
                                  </button>
                                  {' | '}
                                  <button
                                    onClick={() => window.open('https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Note_To_Industry_2024/PRODUCTS-FOR-55-VALIDITY-POLICY.pdf', '_blank')}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3498db',
                                      textDecoration: 'underline',
                                      fontSize: '0.9rem',
                                      fontStyle: 'normal',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                    title="View 5+5 Policy List"
                                  >
                                    5+5 Policy list
                                  </button>
                                </span>
                              )}
                              {item.checkRegulatoryDirective && (
                                <span>
                                  {' '}
                                  <button
                                    onClick={() => window.open('https://nafdac.gov.ng/wp-content/uploads/Files/Resources/Regulatory_Directive/new/NAFDAC-Regulatory-Directives-on-the-Discontinuation-of-Some-Fixed-Dose-Combination-FDCs-Drugs.pdf', '_blank')}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3498db',
                                      textDecoration: 'underline',
                                      fontSize: '0.9rem',
                                      fontStyle: 'normal',
                                      cursor: 'pointer',
                                      padding: 0
                                    }}
                                    title="View NAFDAC Regulatory Directive on FDCs"
                                  >
                                    View FDC regulatory directive
                                  </button>
                                </span>
                              )}
                            </p>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '1rem' }}>
                            {!response && moduleStatus.found && item.id !== 16 && item.id !== 20 && (
                              <div style={{ fontSize: '0.7rem', color: '#28a745', fontStyle: 'italic' }}>
                                ℹ️ Suggested: Yes (files found)
                              </div>
                            )}
                            {!response && !moduleStatus.found && item.moduleRef !== 'General / Pre-screening' && item.moduleRef !== 'Final Decision' && item.id !== 16 && item.id !== 20 && (
                              <div style={{ fontSize: '0.7rem', color: '#dc3545', fontStyle: 'italic' }}>
                                ⚠️ Suggested: No (files missing)
                              </div>
                            )}
                            
                            {item.id === 2 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Product Compliance Check</h5>
                                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                                    Generic name entered above will be checked against regulatory lists.
                                  </p>
                                  {!productInputs.productName ? (
                                    <div style={{ 
                                      padding: '0.75rem', 
                                      background: '#fff3cd', 
                                      border: '1px solid #ffeaa7', 
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      color: '#856404'
                                    }}>
                                      ⚠️ Please enter generic name in the section above first.
                                    </div>
                                  ) : (
                                    <button
                                      onClick={checkProductCompliance}
                                      style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.9rem',
                                        background: '#3498db',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🔍 Re-check Product Compliance
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : item.id === 3 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>FDC Regulatory Check</h5>
                                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                                    Generic name from above will be checked against FDC regulatory directive.
                                  </p>
                                  {!productInputs.productName ? (
                                    <div style={{ 
                                      padding: '0.75rem', 
                                      background: '#fff3cd', 
                                      border: '1px solid #ffeaa7', 
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      color: '#856404'
                                    }}>
                                      ⚠️ Please enter generic name in the section above first.
                                    </div>
                                  ) : (
                                    <button
                                      onClick={checkProductCompliance}
                                      style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.9rem',
                                        background: '#e74c3c',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🔍 Re-check FDC Regulatory Directive
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : item.id === 10 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Narrow Therapeutic Index Check</h5>
                                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                                    Generic name from above will be checked against NTI drug list.
                                  </p>
                                  {!productInputs.productName ? (
                                    <div style={{ 
                                      padding: '0.75rem', 
                                      background: '#fff3cd', 
                                      border: '1px solid #ffeaa7', 
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      color: '#856404'
                                    }}>
                                      ⚠️ Please enter generic name in the section above first.
                                    </div>
                                  ) : (
                                    <button
                                      onClick={checkProductCompliance}
                                      style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.9rem',
                                        background: '#f39c12',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🔍 Re-check NTI Drug List
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : item.id === 6 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>General Checklist Status</h5>
                                  <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                                    Run the general checklist first to check document completeness.
                                  </p>
                                  <button
                                    onClick={runChecklist}
                                    disabled={isRunning}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.9rem',
                                      background: isRunning ? '#f8f9fa' : '#17a2b8',
                                      color: isRunning ? '#666' : 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: isRunning ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {isRunning ? '🔍 Running...' : '📄 Run General Checklist'}
                                  </button>
                                  {results.length > 0 && (
                                    <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                                      <div>Found: {results.filter(r => r.status.includes('✅')).length}/{results.length} documents</div>
                                      <div>Compliance: {Math.round((results.filter(r => r.status.includes('✅')).length / results.length) * 100)}%</div>
                                      {results.filter(r => r.status.includes('❌')).length > 0 && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                          <strong style={{ color: '#dc3545' }}>Missing Files:</strong>
                                          <div style={{ 
                                            maxHeight: '100px', 
                                            overflowY: 'auto', 
                                            marginTop: '0.25rem',
                                            padding: '0.5rem',
                                            background: '#fff5f5',
                                            border: '1px solid #f5c6cb',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem'
                                          }}>
                                            {results.filter(r => r.status.includes('❌')).map((item, index) => (
                                              <div key={index} style={{ marginBottom: '0.25rem' }}>
                                                <div style={{ fontWeight: 'bold', color: '#721c24' }}>{item.description}</div>
                                                <div style={{ color: '#666', fontFamily: 'monospace', fontSize: '0.75rem' }}>{item.path}</div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : item.id === 7 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Word Document Status</h5>
                                  {wordDocResults ? (
                                    <div style={{ fontSize: '0.9rem' }}>
                                      <div style={{ marginBottom: '0.5rem' }}>
                                        <strong>QOS Word Document:</strong> 
                                        {wordDocResults.qosWord ? (
                                          <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                                            ✅ Found: {wordDocResults.qosWord.name}
                                          </span>
                                        ) : (
                                          <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>❌ Missing</span>
                                        )}
                                      </div>
                                      <div>
                                        <strong>QIS Word Document:</strong> 
                                        {wordDocResults.qisWord ? (
                                          <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                                            ✅ Found: {wordDocResults.qisWord.name}
                                          </span>
                                        ) : (
                                          <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>❌ Missing</span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={checkWordDocuments}
                                      style={{
                                        padding: '0.5rem 1rem',
                                        fontSize: '0.9rem',
                                        background: '#17a2b8',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      🔍 Check Word Documents
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : item.id === 9 ? (
                              <div style={{ marginTop: '1rem' }}>
                                <div style={{ 
                                  background: '#f8f9fa', 
                                  padding: '1rem', 
                                  borderRadius: '8px', 
                                  border: '1px solid #e9ecef',
                                  marginBottom: '1rem'
                                }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>BE/BW Data Check</h5>
                                  {(() => {
                                    const result = findModuleFoldersForQuestion(9, item.moduleRef);
                                    const details = result.details || {};
                                    return (
                                      <div style={{ fontSize: '0.9rem' }}>
                                        <div style={{ marginBottom: '0.5rem' }}>
                                          <strong>Module 5.3 BE/BW Data:</strong> 
                                          {details.module5Files > 0 ? (
                                            <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                                              ✅ Found {details.module5Files} file(s)
                                              {details.module5FileNames && details.module5FileNames.length > 0 && (
                                                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#666' }}>
                                                  Files: {details.module5FileNames.join(', ')}
                                                </div>
                                              )}
                                            </span>
                                          ) : (
                                            <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>❌ No BE/BW data found in Module 5.3</span>
                                          )}
                                        </div>
                                        <div>
                                          <strong>BTIF Word Documents (Module 1.4.1):</strong> 
                                          {details.btifBafFiles > 0 ? (
                                            <span style={{ color: '#28a745', marginLeft: '0.5rem' }}>
                                              ✅ Found {details.btifBafFiles} file(s)
                                              {details.btifBafFileNames && details.btifBafFileNames.length > 0 && (
                                                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#666' }}>
                                                  Files: {details.btifBafFileNames.join(', ')}
                                                </div>
                                              )}
                                            </span>
                                          ) : (
                                            <span style={{ color: '#dc3545', marginLeft: '0.5rem' }}>❌ No BTIF Word documents found in Module 1.4.1</span>
                                          )}
                                        </div>
                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#e9ecef', borderRadius: '4px', fontSize: '0.8rem' }}>
                                          <strong>Note:</strong> For solid oral dosage forms (tablets/capsules), both BE/BW data in Module 5.3 and BTIF Word documents in Module 1.4.1 are required.
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'yes')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'yes' ? '#28a745' : '#f8f9fa',
                                      color: response === 'yes' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✓ Yes
                                  </button>
                                  <button
                                    className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'partial')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                      color: response === 'partial' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ~ Partial
                                  </button>
                                  <button
                                    className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                    onClick={() => handleInternalResponse(item.id, 'no')}
                                    style={{
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.8rem',
                                      background: response === 'no' ? '#dc3545' : '#f8f9fa',
                                      color: response === 'no' ? 'white' : '#666',
                                      border: '1px solid #ddd'
                                    }}
                                  >
                                    ✗ No
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className={`btn ${response === 'yes' ? 'btn-success' : ''}`}
                                  onClick={() => handleInternalResponse(item.id, 'yes')}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.8rem',
                                    background: response === 'yes' ? '#28a745' : (moduleStatus.found && !response ? '#e8f5e8' : '#f8f9fa'),
                                    color: response === 'yes' ? 'white' : '#666',
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  ✓ Yes
                                </button>
                                <button
                                  className={`btn ${response === 'partial' ? 'btn-warning' : ''}`}
                                  onClick={() => handleInternalResponse(item.id, 'partial')}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.8rem',
                                    background: response === 'partial' ? '#ffc107' : '#f8f9fa',
                                    color: response === 'partial' ? 'white' : '#666',
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  ~ Partial
                                </button>
                                <button
                                  className={`btn ${response === 'no' ? 'btn-danger' : ''}`}
                                  onClick={() => handleInternalResponse(item.id, 'no')}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.8rem',
                                    background: response === 'no' ? '#dc3545' : (!moduleStatus.found && !response ? '#fde8e8' : '#f8f9fa'),
                                    color: response === 'no' ? 'white' : '#666',
                                    border: '1px solid #ddd'
                                  }}
                                >
                                  ✗ No
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <textarea
                          placeholder="Add notes or comments..."
                          value={note}
                          onChange={(e) => handleInternalNote(item.id, e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            resize: 'vertical'
                          }}
                        />
                      </>
                    )}
                  </div>
                  );
                  })}
                </div>
                
                <div style={{ 
                  background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)', 
                  padding: '2rem', 
                  borderRadius: '16px',
                  border: '2px solid #dee2e6',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  marginTop: '2rem'
                }}>
              <h3 style={{ margin: '0 0 1rem 0' }}>Screening Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Progress:</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {getInternalSummary().answered}/{getInternalSummary().total} questions answered
                  </div>
                </div>
                <div>
                  <strong>Responses:</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    <span style={{ color: '#28a745' }}>✓ Yes: {getInternalSummary().yesCount}</span><br/>
                    <span style={{ color: '#ffc107' }}>~ Partial: {getInternalSummary().partialCount}</span><br/>
                    <span style={{ color: '#dc3545' }}>✗ No: {getInternalSummary().noCount}</span>
                  </div>
                </div>
                <div>
                  <strong>Module Analysis:</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {(() => {
                      const modulesWithFiles = INTERNAL_SCREENING_CHECKLIST.filter(item => 
                        getModuleStatus(item.moduleRef).found
                      ).length;
                      const totalModules = INTERNAL_SCREENING_CHECKLIST.filter(item => 
                        !['General / Pre-screening', 'Final Decision'].includes(item.moduleRef)
                      ).length;
                      return (
                        <>
                          <span style={{ color: '#28a745' }}>Found: {modulesWithFiles}</span><br/>
                          <span style={{ color: '#dc3545' }}>Missing: {totalModules - modulesWithFiles}</span><br/>
                          <span>Coverage: {Math.round((modulesWithFiles / totalModules) * 100)}%</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <strong>Compliance Rate:</strong>
                  <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {getInternalSummary().answered > 0 
                      ? Math.round(((getInternalSummary().yesCount + getInternalSummary().partialCount * 0.5) / getInternalSummary().answered) * 100)
                      : 0}%
                  </div>
                </div>
                <div>
                  <strong>Missing Modules:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(() => {
                      if (results.length === 0) {
                        return (
                          <span style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            background: '#e2e3e5',
                            color: '#6c757d'
                          }}>
                            Run general checklist first
                          </span>
                        );
                      }
                      
                      const missingFiles = results.filter(r => r.status.includes('❌'));
                      const missingModules = new Set();
                      
                      missingFiles.forEach(file => {
                        const path = file.path.toLowerCase();
                        if (path.includes('module 1')) missingModules.add('Module 1');
                        if (path.includes('module 2')) missingModules.add('Module 2');
                        if (path.includes('module 3')) missingModules.add('Module 3');
                        if (path.includes('module 4')) missingModules.add('Module 4');
                        if (path.includes('module 5')) missingModules.add('Module 5');
                        if (path.includes('3.2.s')) missingModules.add('3.2.S (Drug Substance)');
                        if (path.includes('3.2.p')) missingModules.add('3.2.P (Drug Product)');
                        if (path.includes('3.2.r')) missingModules.add('3.2.R (Regional)');
                      });
                      
                      return Array.from(missingModules).length > 0 ? (
                        Array.from(missingModules).map((module, index) => (
                          <span key={index} style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            background: '#f8d7da',
                            color: '#721c24',
                            border: '1px solid #f5c6cb'
                          }}>
                            {module}
                          </span>
                        ))
                      ) : (
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          background: '#d4edda',
                          color: '#155724'
                        }}>
                          All required modules found
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <span style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  background: 
                    getInternalSummary().answered === 0 ? '#6c757d' :
                    getInternalSummary().noCount === 0 && getInternalSummary().yesCount > getInternalSummary().partialCount ? '#28a745' :
                    getInternalSummary().noCount <= 2 ? '#ffc107' : '#dc3545',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}>
                  {
                    getInternalSummary().answered === 0 ? 'NOT STARTED' :
                    getInternalSummary().noCount === 0 && getInternalSummary().yesCount > getInternalSummary().partialCount ? 'APPROVED' :
                    getInternalSummary().noCount <= 2 ? 'NEEDS ATTENTION' : 'MAJOR DEFICIENCIES'
                  }
                </span>
              </div>
                </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Screening;