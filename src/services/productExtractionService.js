import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

class ProductExtractionService {
  async extractProductInfoFromSmPC(file) {
    try {
      console.log('Extracting from file:', file.name);
      
      // Simple filename-based extraction first
      const filenameInfo = this.extractFromFilename(file.name);
      if (filenameInfo.productName) {
        console.log('Extracted from filename:', filenameInfo);
        return filenameInfo;
      }
      
      // Try PDF extraction
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const maxPages = Math.min(pdf.numPages, 2); // Only check first 2 pages
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }
      
      console.log('Extracted text sample:', fullText.substring(0, 200));
      return this.parseProductInfo(fullText);
    } catch (error) {
      console.error('Error extracting product info:', error);
      // Return filename-based extraction as fallback
      return this.extractFromFilename(file.name);
    }
  }
  
  extractFromFilename(filename) {
    const name = filename.toLowerCase().replace('.pdf', '');
    
    // Common drug name patterns
    const drugPatterns = [
      'paracetamol', 'ibuprofen', 'aspirin', 'amoxicillin', 'ciprofloxacin',
      'metronidazole', 'omeprazole', 'amlodipine', 'metformin', 'diclofenac'
    ];
    
    for (const drug of drugPatterns) {
      if (name.includes(drug)) {
        return {
          productName: drug.charAt(0).toUpperCase() + drug.slice(1),
          activeIngredients: [drug.charAt(0).toUpperCase() + drug.slice(1)],
          strength: '',
          dosageForm: name.includes('tablet') ? 'Tablet' : name.includes('capsule') ? 'Capsule' : ''
        };
      }
    }
    
    return { productName: '', activeIngredients: [], strength: '', dosageForm: '' };
  }
  
  parseProductInfo(text) {
    const productInfo = {
      productName: '',
      activeIngredients: [],
      strength: '',
      dosageForm: ''
    };
    
    // Simpler, more flexible patterns
    const cleanText = text.toLowerCase();
    
    // Look for common drug names in text
    const drugNames = [
      'paracetamol', 'ibuprofen', 'aspirin', 'amoxicillin', 'ciprofloxacin',
      'metronidazole', 'omeprazole', 'amlodipine', 'metformin', 'diclofenac',
      'chloroquine', 'cotrimoxazole', 'vitamin', 'ferrous', 'folic'
    ];
    
    for (const drug of drugNames) {
      if (cleanText.includes(drug)) {
        productInfo.productName = drug.charAt(0).toUpperCase() + drug.slice(1);
        productInfo.activeIngredients = [productInfo.productName];
        break;
      }
    }
    
    // Extract dosage form
    if (cleanText.includes('tablet')) productInfo.dosageForm = 'Tablet';
    else if (cleanText.includes('capsule')) productInfo.dosageForm = 'Capsule';
    else if (cleanText.includes('syrup')) productInfo.dosageForm = 'Syrup';
    else if (cleanText.includes('injection')) productInfo.dosageForm = 'Injection';
    
    // Extract strength
    const strengthMatch = text.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%))/i);
    if (strengthMatch) {
      productInfo.strength = strengthMatch[1];
    }
    
    return productInfo;
  }
  
  async findSmPCFile(dossier) {
    const findSmPCRecursively = (node) => {
      if (node.type === 'file') {
        const fileName = node.name.toLowerCase();
        const filePath = node.path?.toLowerCase() || '';
        
        // Broader search for any PDF that might contain product info
        if (fileName.endsWith('.pdf') && (
          fileName.includes('smpc') || 
          fileName.includes('summary') ||
          fileName.includes('product') ||
          filePath.includes('1.3.1') ||
          filePath.includes('module 1') ||
          // Look for any PDF with drug names
          fileName.includes('paracetamol') ||
          fileName.includes('ibuprofen') ||
          fileName.includes('tablet') ||
          fileName.includes('capsule')
        )) {
          console.log('Found potential SmPC file:', fileName);
          return node;
        }
      }
      
      if (node.children) {
        for (const child of node.children) {
          const found = findSmPCRecursively(child);
          if (found) return found;
        }
      }
      
      return null;
    };
    
    const result = findSmPCRecursively(dossier.root);
    console.log('SmPC search result:', result?.name || 'Not found');
    return result;
  }
}

export const productExtractionService = new ProductExtractionService();