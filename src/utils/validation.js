// Comprehensive input validation for file operations

export const FileValidationError = class extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
    this.details = details;
  }
};

// File type validation
export const validateFileType = (file, allowedTypes = []) => {
  if (!file) {
    throw new FileValidationError('No file provided', 'NO_FILE');
  }

  if (!(file instanceof File)) {
    throw new FileValidationError('Invalid file object', 'INVALID_FILE_OBJECT');
  }

  if (allowedTypes.length > 0) {
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const mimeType = file.type.toLowerCase();
    
    const isValidExtension = allowedTypes.some(type => 
      fileExtension === type.toLowerCase() || 
      mimeType.includes(type.toLowerCase())
    );
    
    if (!isValidExtension) {
      throw new FileValidationError(
        `File type not allowed. Expected: ${allowedTypes.join(', ')}`,
        'INVALID_FILE_TYPE',
        { allowedTypes, actualType: fileExtension, mimeType }
      );
    }
  }

  return true;
};

// File size validation
export const validateFileSize = (file, maxSize = 500 * 1024 * 1024, minSize = 0) => {
  if (!file) {
    throw new FileValidationError('No file provided', 'NO_FILE');
  }

  if (file.size > maxSize) {
    throw new FileValidationError(
      `File too large. Maximum size: ${formatFileSize(maxSize)}`,
      'FILE_TOO_LARGE',
      { maxSize, actualSize: file.size, formattedMax: formatFileSize(maxSize) }
    );
  }

  if (file.size < minSize) {
    throw new FileValidationError(
      `File too small. Minimum size: ${formatFileSize(minSize)}`,
      'FILE_TOO_SMALL',
      { minSize, actualSize: file.size, formattedMin: formatFileSize(minSize) }
    );
  }

  return true;
};

// ZIP file validation
export const validateZipFile = (file) => {
  validateFileType(file, ['zip']);
  validateFileSize(file, 500 * 1024 * 1024, 1024); // Max 500MB, Min 1KB
  
  // Additional ZIP-specific validation
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new FileValidationError(
      'File must have .zip extension',
      'INVALID_ZIP_EXTENSION'
    );
  }

  return true;
};

// Path validation for security
export const validateFilePath = (path) => {
  if (!path || typeof path !== 'string') {
    throw new FileValidationError('Invalid file path', 'INVALID_PATH');
  }

  // Check for path traversal attempts
  const dangerousPatterns = [
    '../', '..\\', './', '.\\',
    '%2e%2e%2f', '%2e%2e%5c',
    '..%2f', '..%5c'
  ];

  const normalizedPath = path.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (normalizedPath.includes(pattern)) {
      throw new FileValidationError(
        'Path contains dangerous characters',
        'DANGEROUS_PATH',
        { path, pattern }
      );
    }
  }

  // Check for null bytes
  if (path.includes('\0')) {
    throw new FileValidationError(
      'Path contains null bytes',
      'NULL_BYTE_PATH'
    );
  }

  // Check path length
  if (path.length > 260) { // Windows MAX_PATH limit
    throw new FileValidationError(
      'Path too long',
      'PATH_TOO_LONG',
      { maxLength: 260, actualLength: path.length }
    );
  }

  return true;
};

// Filename validation
export const validateFileName = (filename) => {
  if (!filename || typeof filename !== 'string') {
    throw new FileValidationError('Invalid filename', 'INVALID_FILENAME');
  }

  // Check for reserved characters
  const reservedChars = /[<>:"|?*\x00-\x1f]/;
  if (reservedChars.test(filename)) {
    throw new FileValidationError(
      'Filename contains reserved characters',
      'RESERVED_CHARS',
      { filename, reservedChars: '<>:"|?*' }
    );
  }

  // Check for reserved names (Windows)
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];

  const nameWithoutExt = filename.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    throw new FileValidationError(
      'Filename uses reserved name',
      'RESERVED_NAME',
      { filename, reservedName: nameWithoutExt }
    );
  }

  // Check filename length
  if (filename.length > 255) {
    throw new FileValidationError(
      'Filename too long',
      'FILENAME_TOO_LONG',
      { maxLength: 255, actualLength: filename.length }
    );
  }

  return true;
};

// Dossier structure validation
export const validateDossierStructure = (fileTree) => {
  if (!fileTree || typeof fileTree !== 'object') {
    throw new FileValidationError('Invalid dossier structure', 'INVALID_STRUCTURE');
  }

  const requiredModules = ['module 1', 'module 2', 'module 3'];
  const foundModules = [];

  const scanForModules = (node, path = '') => {
    if (node.type === 'folder') {
      const folderName = node.name.toLowerCase();
      requiredModules.forEach(module => {
        if (folderName.includes(module)) {
          foundModules.push(module);
        }
      });
    }

    if (node.children) {
      node.children.forEach(child => scanForModules(child, path + '/' + node.name));
    }
  };

  scanForModules(fileTree);

  const missingModules = requiredModules.filter(module => 
    !foundModules.some(found => found.includes(module))
  );

  if (missingModules.length > 0) {
    console.warn('Missing recommended modules:', missingModules);
    // Don't throw error, just warn for now
  }

  return {
    valid: true,
    foundModules: [...new Set(foundModules)],
    missingModules
  };
};

// Batch validation for multiple files
export const validateFilesBatch = (files, options = {}) => {
  const {
    maxTotalSize = 1024 * 1024 * 1024, // 1GB total
    allowedTypes = [],
    maxFileSize = 100 * 1024 * 1024, // 100MB per file
    maxFileCount = 1000
  } = options;

  if (!Array.isArray(files)) {
    throw new FileValidationError('Files must be an array', 'INVALID_FILES_ARRAY');
  }

  if (files.length > maxFileCount) {
    throw new FileValidationError(
      `Too many files. Maximum: ${maxFileCount}`,
      'TOO_MANY_FILES',
      { maxCount: maxFileCount, actualCount: files.length }
    );
  }

  let totalSize = 0;
  const validationResults = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    try {
      if (allowedTypes.length > 0) {
        validateFileType(file, allowedTypes);
      }
      validateFileSize(file, maxFileSize);
      validateFileName(file.name);
      
      totalSize += file.size;
      
      validationResults.push({
        index: i,
        file: file.name,
        valid: true
      });
    } catch (error) {
      validationResults.push({
        index: i,
        file: file.name,
        valid: false,
        error: error.message,
        code: error.code
      });
    }
  }

  if (totalSize > maxTotalSize) {
    throw new FileValidationError(
      `Total file size too large. Maximum: ${formatFileSize(maxTotalSize)}`,
      'TOTAL_SIZE_TOO_LARGE',
      { 
        maxSize: maxTotalSize, 
        actualSize: totalSize,
        formattedMax: formatFileSize(maxTotalSize),
        formattedActual: formatFileSize(totalSize)
      }
    );
  }

  const invalidFiles = validationResults.filter(result => !result.valid);
  
  return {
    valid: invalidFiles.length === 0,
    totalSize,
    formattedTotalSize: formatFileSize(totalSize),
    validFiles: validationResults.filter(result => result.valid).length,
    invalidFiles: invalidFiles.length,
    results: validationResults,
    errors: invalidFiles
  };
};

// Utility function to format file sizes
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Content validation for specific file types
export const validatePDFContent = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check PDF header
    const pdfHeader = '%PDF-';
    const headerBytes = uint8Array.slice(0, 5);
    const headerString = String.fromCharCode(...headerBytes);
    
    if (!headerString.startsWith(pdfHeader)) {
      throw new FileValidationError(
        'File is not a valid PDF',
        'INVALID_PDF_HEADER'
      );
    }

    // Check for PDF trailer
    const trailerPattern = '%%EOF';
    const endBytes = uint8Array.slice(-10);
    const endString = String.fromCharCode(...endBytes);
    
    if (!endString.includes(trailerPattern)) {
      console.warn('PDF may be truncated or corrupted');
    }

    return true;
  } catch (error) {
    throw new FileValidationError(
      'Failed to validate PDF content',
      'PDF_VALIDATION_FAILED',
      { originalError: error.message }
    );
  }
};

// Security validation
export const validateFileForSecurity = (file) => {
  // Check for suspicious file extensions
  const suspiciousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'app', 'deb', 'pkg', 'rpm', 'dmg', 'iso'
  ];
  
  const extension = file.name.toLowerCase().split('.').pop();
  
  if (suspiciousExtensions.includes(extension)) {
    throw new FileValidationError(
      'File type not allowed for security reasons',
      'SECURITY_RISK',
      { extension, suspiciousExtensions }
    );
  }

  // Check for double extensions
  const nameParts = file.name.toLowerCase().split('.');
  if (nameParts.length > 2) {
    const secondLastExt = nameParts[nameParts.length - 2];
    if (suspiciousExtensions.includes(secondLastExt)) {
      throw new FileValidationError(
        'Double extension detected - potential security risk',
        'DOUBLE_EXTENSION_RISK',
        { filename: file.name }
      );
    }
  }

  return true;
};

// Main validation function that combines all checks
export const validateFile = async (file, options = {}) => {
  const {
    allowedTypes = [],
    maxSize = 100 * 1024 * 1024,
    minSize = 0,
    validateContent = false,
    securityCheck = true
  } = options;

  try {
    // Basic validations
    if (allowedTypes.length > 0) {
      validateFileType(file, allowedTypes);
    }
    
    validateFileSize(file, maxSize, minSize);
    validateFileName(file.name);
    
    if (securityCheck) {
      validateFileForSecurity(file);
    }

    // Content validation for specific types
    if (validateContent && file.type === 'application/pdf') {
      await validatePDFContent(file);
    }

    return {
      valid: true,
      file: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: file.type
    };

  } catch (error) {
    return {
      valid: false,
      file: file.name,
      error: error.message,
      code: error.code,
      details: error.details
    };
  }
};