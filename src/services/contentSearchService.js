import { dossierService } from './dossierService';
import * as pdfjsLib from 'pdfjs-dist';

class ContentSearchService {
  constructor() {
    this.textCache = new Map(); // Cache extracted text
    this.searchIndex = new Map(); // Search index for faster lookups
  }

  // Extract text from PDF
  async extractPDFText(fileBlob) {
    try {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.warn('PDF text extraction failed:', error);
      return '';
    }
  }

  // Search for terms in a single file
  async searchInFile(filePath, searchTerms) {
    try {
      const fileData = await dossierService.getFileBlob(filePath);
      if (!fileData || !fileData.blob) return { found: false, matches: [] };

      // Check cache first
      let text = this.textCache.get(filePath);
      if (!text) {
        if (fileData.type === 'application/pdf') {
          text = await this.extractPDFText(fileData.blob);
          this.textCache.set(filePath, text);
        } else {
          return { found: false, matches: [] };
        }
      }

      const matches = [];
      const textLower = text.toLowerCase();
      
      searchTerms.forEach(term => {
        const termLower = term.toLowerCase();
        const regex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        const termMatches = [...text.matchAll(regex)];
        
        termMatches.forEach(match => {
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + match[0].length + 50);
          const context = text.substring(start, end);
          
          matches.push({
            term: term,
            context: context.trim(),
            position: match.index
          });
        });
      });

      return {
        found: matches.length > 0,
        matches: matches,
        filePath: filePath
      };
    } catch (error) {
      console.warn(`Search failed for ${filePath}:`, error);
      return { found: false, matches: [] };
    }
  }

  // Search across multiple files
  async searchAcrossFiles(filePaths, searchTerms) {
    const results = [];
    
    for (const filePath of filePaths) {
      const result = await this.searchInFile(filePath, searchTerms);
      if (result.found) {
        results.push(result);
      }
    }
    
    return results;
  }

  // Search for drug names (common pharmaceutical terms)
  async searchForDrugInfo(filePaths, drugName) {
    const drugTerms = [
      drugName,
      `${drugName} tablets`,
      `${drugName} capsules`,
      `${drugName} mg`,
      `active ingredient`,
      `drug substance`,
      `api`
    ];
    
    return await this.searchAcrossFiles(filePaths, drugTerms);
  }

  // Search for regulatory references
  async searchForRegulatoryRefs(filePaths) {
    const regulatoryTerms = [
      'ich guideline',
      'ich q',
      'ich m',
      'ich e',
      'ich s',
      'who guideline',
      'usp',
      'bp',
      'ep',
      'nafdac',
      'fda',
      'ema',
      'gmp',
      'glp',
      'gcp',
      'stability study',
      'bioequivalence',
      'dissolution',
      'impurity',
      'specification'
    ];
    
    return await this.searchAcrossFiles(filePaths, regulatoryTerms);
  }

  // Search for specific data tables/sections
  async searchForDataSections(filePaths, sectionType) {
    const sectionTerms = {
      stability: ['stability data', 'stability study', 'storage condition', 'shelf life'],
      manufacturing: ['batch formula', 'manufacturing process', 'process validation'],
      analytical: ['analytical method', 'method validation', 'specification', 'test procedure'],
      clinical: ['clinical study', 'bioequivalence', 'pharmacokinetic', 'adverse event'],
      quality: ['quality control', 'quality assurance', 'batch analysis', 'certificate of analysis']
    };
    
    const terms = sectionTerms[sectionType] || [sectionType];
    return await this.searchAcrossFiles(filePaths, terms);
  }

  // Get all files from dossier for searching
  async getAllDossierFiles() {
    const dossier = await dossierService.getCachedDossier();
    if (!dossier) return [];

    const files = [];
    const traverse = (node) => {
      if (node.type === 'file' && node.name.toLowerCase().endsWith('.pdf')) {
        files.push(node.path);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    if (dossier.root) {
      traverse(dossier.root);
    }
    
    return files;
  }

  // Quick search for specific terms across entire dossier
  async quickSearch(searchTerms) {
    const allFiles = await this.getAllDossierFiles();
    return await this.searchAcrossFiles(allFiles, searchTerms);
  }

  // Clear cache
  clearCache() {
    this.textCache.clear();
    this.searchIndex.clear();
  }
}

export const contentSearchService = new ContentSearchService();