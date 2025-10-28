// NAFDAC Ceiling List - Prohibited products for registration
export const NAFDAC_CEILING_LIST = [
  { id: 1, activeIngredient: "AMPICILLIN", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 2, activeIngredient: "INDOMETHACIN", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 3, activeIngredient: "TETRACYCLINE", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 4, activeIngredient: "CYPROHEPTADINE", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 5, activeIngredient: "SULPHADOXINE/PYRIMETHAMINE", strength: "", dosageForm: "ALL DOSAGE FORMS" },
  { id: 6, activeIngredient: "PIPERAQUINE", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 7, activeIngredient: "MEBENDAZOLE", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 8, activeIngredient: "PSEUDOEPHEDRINE+PARACETAMOL+CAFFEINE", strength: "", dosageForm: "ALL DOSAGE FORMS" },
  { id: 9, activeIngredient: "IBUPROFEN", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 10, activeIngredient: "ALCOHOL BASED HAND SANITIZERS", strength: "", dosageForm: "" },
  { id: 11, activeIngredient: "ALBENDAZOLE", strength: "ALL STRENGTH", dosageForm: "ALL DOSAGE FORMS" },
  { id: 12, activeIngredient: "PARACETAMOL CONTAINING FIXED DOSE COMBINATION", strength: "", dosageForm: "ALL DOSAGE FORMS" },
  { id: 13, activeIngredient: "VITAMIN C (ASCORBIC ACID)", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 14, activeIngredient: "OMEPRAZOLE", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 15, activeIngredient: "CHLORPHENIRAMINE MALEATE", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 16, activeIngredient: "PREDNISOLONE TABLET", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 17, activeIngredient: "DIAZEPAM", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 18, activeIngredient: "CIPROFLOXACIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 19, activeIngredient: "PIROXICAM", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 20, activeIngredient: "IBUPROFEN CONTAINING FIXED DOSE COMBINATION", strength: "", dosageForm: "ALL DOSAGE FORMS" },
  { id: 21, activeIngredient: "AMLODIPINE", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 22, activeIngredient: "CIMETIDINE", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 23, activeIngredient: "HYOSCINE BUTYLBROMIDE", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 24, activeIngredient: "AMOXICILLIN/CLAVULANIC ACID", strength: "ALL STRENGTHS", dosageForm: "ORAL DOSAGE FORMS (*Excluding Parenteral)" },
  { id: 25, activeIngredient: "AMOXICILLIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS (Including dispersible tablets)" },
  { id: 26, activeIngredient: "ERYTHROMYCIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 27, activeIngredient: "AMPICILLIN/CLOXACILLIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 28, activeIngredient: "GRISEOFULVIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 29, activeIngredient: "METFORMIN", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 30, activeIngredient: "SALBUTAMOL+ THEOPHYLLINE", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS" },
  { id: 31, activeIngredient: "SALBUTAMOL", strength: "ALL STRENGTHS", dosageForm: "ALL DOSAGE FORMS (Excluding Inhalers)" },
  { id: 32, activeIngredient: "BISACODYL", strength: "", dosageForm: "ALL DOSAGE FORMS" },
  { id: 33, activeIngredient: "TOPICAL PRODUCTS CONTAINING SALICYLIC ACID", strength: "", dosageForm: "CREAMS" },
  { id: 34, activeIngredient: "TOPICAL BENZYL BENZOATE PREPARATIONS", strength: "", dosageForm: "EMULSIONS" },
  { id: 35, activeIngredient: "TOPICAL SULPHUR OINTMENT", strength: "", dosageForm: "" },
  { id: 36, activeIngredient: "TOPICAL PENICILLIN OINTMENT", strength: "", dosageForm: "" }
];

// Function to check if a product is on the ceiling list
export const checkCeilingList = (productName, activeIngredient = "") => {
  const searchTerms = [productName, activeIngredient].filter(Boolean).map(term => term.toLowerCase());
  
  return NAFDAC_CEILING_LIST.some(item => {
    const ingredient = item.activeIngredient.toLowerCase();
    return searchTerms.some(term => 
      ingredient.includes(term) || term.includes(ingredient.split(/[/+\s]/)[0])
    );
  });
};