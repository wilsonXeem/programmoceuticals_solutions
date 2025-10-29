import { FDC_REMAINING_ENTRIES } from './fdcRegulatoryDirective_part2.js';

// NAFDAC Regulatory Directive on Discontinuation of Registration of Fixed Dose Combinations (FDCs)
export const FDC_REGULATORY_DIRECTIVE_LIST = [
  { id: 1, combination: "Diclofenac, Paracetamol" },
  { id: 2, combination: "Aceclofenac, Paracetamol, Chlorzoxazone" },
  { id: 3, combination: "Diclofenac, Paracetamol, Chlorzoxazone" },
  { id: 4, combination: "Ibuprofen, Paracetamol, Caffeine" },
  { id: 5, combination: "Aceclofenac, Paracetamol" },
  { id: 6, combination: "Aceclofenac, Paracetamol, Serratiopeptidase" },
  { id: 7, combination: "Aceclofenac, Serratiopeptidase" },
  { id: 8, combination: "Ibuprofen, Paracetamol" },
  { id: 9, combination: "Aceclofenac (SR) + Paracetamol" },
  { id: 10, combination: "Aceclofenac + Paracetamol + Famotidine" },
  { id: 11, combination: "Aceclofenac + Paracetamol + Rabeprazole" },
  { id: 12, combination: "Aceclofenac + Zinc Carnosine" },
  { id: 13, combination: "Acetaminophen + Guaifenesin + Dextromethorphan + Chlorpheniramine" },
  { id: 14, combination: "Acetaminophen + Loratadine + Ambroxol + Phenylephrine" },
  { id: 15, combination: "Acriflavine + Thymol + Cetrimide" },
  { id: 16, combination: "Acrivastine + Paracetamol + Caffeine + Phenylephrine" },
  { id: 17, combination: "Albuterol + Bromhexine + Theophylline" },
  { id: 18, combination: "Albuterol + Etofylline + Bromhexine + Menthol" },
  { id: 19, combination: "Alginic Acid + Sodium Bicarbonate + Dried Aluminium Hydroxide + Magnesium Hydroxide" },
  { id: 20, combination: "Allantoin + Dimethieone + Urea + Propylene + Glycerin + Liquid Paraffin" },
  { id: 21, combination: "Ambroxol + Levocetirizine + Phenylephrine + Guaiphenesin + Menthol" },
  { id: 22, combination: "Ambroxol + Guaifenesin + Phenylephrine + Chlorpheniramine" },
  { id: 23, combination: "Ambroxol + Salbutamol + Choline Theophyllinate + Menthol" },
  { id: 24, combination: "Ambroxol + Salbutamol + Theophylline" },
  { id: 25, combination: "Ambroxol + Terbutaline + Dextromethorphan" },
  { id: 26, combination: "Ambroxol+ Guaiphenesin + Ammonium Chloride + Phenylephrine + Chlorpheniramine Maleate + Menthol" },
  { id: 27, combination: "Ammonium Chloride + Dextromethorphan + Cetirizine + Menthol" },
  { id: 28, combination: "Ammonium Chloride + Sodium Citrate + Chlorpheniramine Maleate + Menthol" },
  { id: 29, combination: "Ammonium Citrate + Vitamin B 12 + Folic Acid + Zinc Sulphate" },
  { id: 30, combination: "Amoxicillin + Cefixime + Potassium Clavulanic Acid" },
  { id: 31, combination: "Amoxicillin + Dicloxacillin" },
  { id: 32, combination: "Amoxicillin 250 mg + Potassium Clavulanate Diluted 62.5" },
  { id: 33, combination: "Amoxycillin + Dicloxacillin + Serratiopeptidase" },
  { id: 34, combination: "Amoxycillin + Tinidazole" },
  { id: 35, combination: "Ascorbic Acid + Manadione Sodium Bisulphate + Rutin + Dibasic Calcium Phosphate + Adrenochrome mono Se" },
  { id: 36, combination: "Atorvastatin + Vitamin D3 + Folic Acid + Vitamin B12 + Pyridoxine" },
  { id: 37, combination: "Azithromycin + Acebrophylline" },
  { id: 38, combination: "Azithromycin + Ambroxol" },
  { id: 39, combination: "Azithromycin + Cefixime" },
  { id: 40, combination: "Azithromycin + Cefpodoxime" },
  { id: 41, combination: "Azithromycin + Levofloxacin" },
  { id: 42, combination: "Azithromycin + Ofloxacin" },
  { id: 43, combination: "Becloemthasone + Clotrimazole + Chloramphenicol + Gentamycin + Lignocaine Ear drops" },
  { id: 44, combination: "Beclomethasone + Clotimazole + Neomycin + lodochlorohydroxyquinone" },
  { id: 45, combination: "Beclomethasone + Clotrimazole + Gentamicin + lodochlorhydroxyquinoline" },
  { id: 46, combination: "Beclomethasone Diproprionate + Neomycin + Tolnaftate + lodochlorhydroxyquinoline +Chlorocresol" },
  { id: 47, combination: "Benfotiamine + Metformin" },
  { id: 48, combination: "Benzoxonium Chloride + Lidocaine" },
  { id: 49, combination: "Betahistine + Ginkgo Biloba Extract + Vinpocetine + Piracetam" },
  { id: 50, combination: "Betamethasone + Fusidic Acid + Gentamycin + Tolnaftate + lodochlorhydroxyquinoline (ICHQ)" },
  { id: 51, combination: "Betamethasone + Gentamicin + Tolnaftate + lodochlorhydroxyquinoline" },
  { id: 52, combination: "Betamethasone + Gentamycin + Zinc Sulphate + Clotrimoazole + Chlorocresol" },
  { id: 53, combination: "Betamethasone + Neomycin + Tolnaftate + lodochlorohydroxyquinoline + Cholorocresol" },
  { id: 54, combination: "Borax + Boric Acid + Naphazoline + Menthol + Camphor + Methyl Hydroxy Benzoate" },
  { id: 55, combination: "Bromhenxine + Phenylephrine + Chlorpheniramine + Paracetamol" },
  { id: 56, combination: "Bromhexine + Cetrizine + Phenylephrine IP+Guaifenesin + Menthol" },
  { id: 57, combination: "Bromhexine + Dextromethorphan" },
  { id: 58, combination: "Bromhexine + Dextromethorphan + Phenylephrine + Menthol" },
  { id: 59, combination: "Bromhexine + Phenylephrine + Chlorepheniramine Maleate" },
  { id: 60, combination: "Caffeine + Paracetamol + Chlorpheniramine" },
  { id: 61, combination: "Caffeine + Paracetamol + Phenylephrine + Cetirizine" },
  { id: 62, combination: "Calcium Gluconate + Chlorpheniramine + Vitamin C" },
  { id: 63, combination: "Calcium Gluconate + Levocetirizine" },
  { id: 64, combination: "Cefixime + Levofloxacin" },
  { id: 65, combination: "Cefixime + Linezolid" },
  { id: 66, combination: "Cefpodoxime Proxetil + Levofloxacin" },
  { id: 67, combination: "Cefuroxime + Linezolid" },
  { id: 68, combination: "Cephalexin + Neomycin + Prednisolone" },
  { id: 69, combination: "Certirizine + Phenylephrine + Paracetamol + Caffeine + Nimesulide" },
  { id: 70, combination: "Cetirizine + Acetaminophen + Dextromethorphan + Phenyephrine + Zinc Gluconate" },
  { id: 71, combination: "Cetirizine + Ambroxol + Guaiphenesin + Ammonium Chloride + Phenylephrine + Menthol" },
  { id: 72, combination: "Cetirizine + Dextromethorphan + Ambroxol" },
  { id: 73, combination: "Cetirizine + Dextromethorphan + Bromhexine + Guaifenesin" },
  { id: 74, combination: "Cetirizine + Dextromethorphan + Phenylephrine + Tulsi" },
  { id: 75, combination: "Cetirizine + Dextromethorphan + Phenylephrine + Zinc Gluconate + Paracetamol + Menthol" },
  { id: 76, combination: "Cetirizine + Dextromethorphan + Zinc Gluconate + Menthol" },
  { id: 77, combination: "Cetirizine + Diethyl Carbamazine" },
  { id: 78, combination: "Cetirizine + Phenylephrine + Dextromethorphan + Menthol" },
  { id: 79, combination: "Cetirizine + Phenylephrine + Paracetamol + Ambroxol + Caffeine" },
  { id: 80, combination: "Cetirizine + Phenylephrine + Paracetamol + Zinc Gluconate" },
  { id: 81, combination: "Cetririzine + Nimesulide + Phenylephrine" },
  { id: 82, combination: "Chlopheniramine Maleate + Dextromethorphan + Guaiphensin + Phenylephrine" },
  { id: 83, combination: "Chloramphenicol + Beclomethasone + Clomitrimazole + Lignocaine" },
  { id: 84, combination: "Chloramphennicol + Lignocaine + Betamethasone + Clotrimazole + Ofloxacin + Antipyrine" },
  { id: 85, combination: "Chlorphaniramine + Ammonium Chloride + Sodium Chloride" },
  { id: 86, combination: "Chlorpheniramine + Ammonium Chloride + Chloroform + Menthol" },
  { id: 87, combination: "Chlorpheniramine + Ammonium Chloride + Noscapine + Sodium Citrate" },
  { id: 88, combination: "Chlorpheniramine + Codeine + Sodium Citrate + Menthol Syrup" },
  { id: 89, combination: "Chlorpheniramine + Dextromethorphan + Phenylephrine + Paracetamol" },
  { id: 90, combination: "Chlorpheniramine + Paracetamol + Pseudoephedrine + Caffeine" },
  { id: 91, combination: "Chlorpheniramine + Phenylephrine + Caffeine" },
  { id: 92, combination: "Chlorpheniramine + Phenylephrine + Dextromethophan + Menthol" },
  { id: 93, combination: "Chlorpheniramine + Phenylephrine + Paracetamol + Zink Gluconate" },
  { id: 94, combination: "Chlorpheniramine + Terpin + Antimony Potassium Tartrate + Ammonium Chloride + SodiumCitrate + Menthol" },
  { id: 95, combination: "Chlorpheniramine + Vasaka + Tolubalsm + Ammonium Chloride + Sodium Citrate + Menthol" },
  { id: 96, combination: "Chlorpheniramine + Vitamin C" },
  { id: 97, combination: "Chlorpheniramine Maleate + Ammonium Chloride + Sodium Citrate" },
  { id: 98, combination: "Chlorpheniramine+Ammonium Chloride + Menthol" },
  { id: 99, combination: "Chlorpromazine + Trihexyphenidyl" },
  { id: 100, combination: "Chromium Polynicotinate + Metformin" },
  ...FDC_REMAINING_ENTRIES
];

export const checkFDCRegulatoryDirective = (productName, activeIngredients = []) => {
  const searchTerms = [productName, ...activeIngredients].filter(Boolean);
  
  return FDC_REGULATORY_DIRECTIVE_LIST.find(item => {
    const combination = item.combination.toLowerCase();
    
    return searchTerms.some(searchTerm => {
      const cleanSearchTerm = searchTerm.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      const activeIngredientWords = cleanSearchTerm.split(/\s+/).filter(word => 
        word.length > 3 && 
        !['tablets', 'capsules', 'injection', 'syrup', 'suspension', 'cream', 'ointment', 'drops', 'solution'].includes(word)
      );
      
      // Check for single word matches (like "Chloroquine")
      if (activeIngredientWords.length === 1) {
        return combination.includes(activeIngredientWords[0]);
      }
      
      // Check for multi-word matches
      if (activeIngredientWords.length >= 2) {
        const matchCount = activeIngredientWords.filter(word => 
          combination.includes(word)
        ).length;
        return matchCount >= 2;
      }
      
      return false;
    });
  });
};