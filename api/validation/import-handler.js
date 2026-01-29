// Import Validation Handler
// Orchestrates file parsing, schema validation, and security checks

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { validateChallengeFile, validateSingleChallenge } = require('./validators');

/**
 * Main import validation function
 * @param {String} filePath - Path to uploaded file
 * @param {Object} metadata - File metadata (fileName, fileType, fileSize)
 * @returns {Object} Comprehensive validation result
 */
async function validateImport(filePath, metadata = {}) {
  const { fileName = 'unknown', fileType = '', fileSize = 0 } = metadata;

  console.log(`Starting validation for ${fileName} (${fileType})`);

  try {
    let challengeData;
    let extractedFiles = [];

    // Parse file based on type
    if (fileType === '.json') {
      challengeData = await parseJSONFile(filePath, fileName);
    } else if (fileType === '.zip') {
      const result = await parseZIPFile(filePath, fileName);
      challengeData = result.challengeData;
      extractedFiles = result.extractedFiles;
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Validate parsed data
    const validationResult = validateChallengeFile(challengeData, {
      includeWarnings: true,
      includeSuggestions: true
    });

    // Add import-specific metadata
    validationResult.import = {
      fileName,
      fileType,
      fileSize,
      extractedFiles,
      processedAt: new Date().toISOString()
    };

    // Add processed challenges for successful imports
    if (validationResult.valid && challengeData.challenges) {
      validationResult.challenges = challengeData.challenges.map(challenge => ({
        ...challenge,
        imported: true,
        importedAt: new Date().toISOString(),
        importSource: fileName
      }));
    }

    return validationResult;

  } catch (error) {
    console.error('Import validation error:', error);

    return {
      valid: false,
      errors: [{
        path: 'file',
        message: `Failed to process ${fileName}: ${error.message}`,
        suggestion: getErrorSuggestion(error.message, fileType),
        severity: 'error'
      }],
      warnings: [],
      suggestions: [],
      summary: {
        totalChallenges: 0,
        validChallenges: 0,
        errorCount: 1,
        warningCount: 0
      },
      import: {
        fileName,
        fileType,
        fileSize,
        processedAt: new Date().toISOString(),
        error: error.message
      }
    };
  }
}

/**
 * Parse JSON challenge file
 * @param {String} filePath - Path to JSON file
 * @param {String} fileName - Original filename
 * @returns {Object} Parsed challenge data
 */
async function parseJSONFile(filePath, fileName) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (!fileContent.trim()) {
      throw new Error('File is empty');
    }

    let challengeData;
    try {
      challengeData = JSON.parse(fileContent);
    } catch (jsonError) {
      throw new Error(`Invalid JSON format: ${jsonError.message}`);
    }

    // Validate basic structure
    if (typeof challengeData !== 'object' || challengeData === null) {
      throw new Error('Challenge file must contain a JSON object');
    }

    // Handle both single challenge and multi-challenge formats
    if (Array.isArray(challengeData)) {
      // Convert array to standard format
      challengeData = {
        schema_version: '1.0',
        challenges: challengeData
      };
    } else if (challengeData.id && !challengeData.challenges) {
      // Single challenge object
      challengeData = {
        schema_version: '1.0',
        challenges: [challengeData]
      };
    }

    if (!challengeData.challenges) {
      throw new Error('No challenges found. File should contain a "challenges" array or be a single challenge object');
    }

    if (!Array.isArray(challengeData.challenges)) {
      throw new Error('Challenges must be an array');
    }

    if (challengeData.challenges.length === 0) {
      throw new Error('At least one challenge is required');
    }

    if (challengeData.challenges.length > 100) {
      throw new Error('Maximum 100 challenges per file');
    }

    console.log(`Parsed ${challengeData.challenges.length} challenge(s) from ${fileName}`);
    return challengeData;

  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

/**
 * Parse ZIP challenge archive
 * @param {String} filePath - Path to ZIP file
 * @param {String} fileName - Original filename
 * @returns {Object} Parsed challenge data and extracted files info
 */
async function parseZIPFile(filePath, fileName) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    let configEntry = null;
    let dockerfileEntry = null;
    const extractedFiles = [];

    // Find required files
    entries.forEach(entry => {
      const entryName = entry.entryName.toLowerCase();
      extractedFiles.push({
        name: entry.entryName,
        size: entry.header.size,
        compressed: entry.header.compressedSize,
        isDirectory: entry.isDirectory
      });

      if (entryName === 'config.json' || entryName.endsWith('/config.json')) {
        configEntry = entry;
      } else if (entryName === 'dockerfile' || entryName.endsWith('/dockerfile')) {
        dockerfileEntry = entry;
      }
    });

    if (!configEntry) {
      throw new Error('config.json not found in ZIP archive');
    }

    if (!dockerfileEntry) {
      throw new Error('Dockerfile not found in ZIP archive');
    }

    // Parse config.json
    let challengeData;
    try {
      const configContent = configEntry.getData().toString('utf8');
      challengeData = JSON.parse(configContent);
    } catch (error) {
      throw new Error(`Invalid config.json: ${error.message}`);
    }

    // Validate Dockerfile exists and is readable
    const dockerfileContent = dockerfileEntry.getData().toString('utf8');
    if (!dockerfileContent.trim()) {
      throw new Error('Dockerfile is empty');
    }

    if (!dockerfileContent.toLowerCase().includes('from ')) {
      throw new Error('Dockerfile must contain a FROM instruction');
    }

    // Convert single challenge to array format
    if (!Array.isArray(challengeData)) {
      challengeData = [challengeData];
    }

    const result = {
      schema_version: '1.0',
      challenges: challengeData.map(challenge => ({
        ...challenge,
        container_spec: {
          ...challenge.container_spec,
          // Mark as custom build from ZIP
          build: {
            dockerfile: 'Dockerfile',
            context: '.'
          }
        }
      }))
    };

    console.log(`Extracted ${result.challenges.length} challenge(s) from ${fileName}`);
    return {
      challengeData: result,
      extractedFiles
    };

  } catch (error) {
    throw new Error(`ZIP processing failed: ${error.message}`);
  }
}

/**
 * Provide contextual error suggestions
 * @param {String} errorMessage - The error message
 * @param {String} fileType - File type (.json or .zip)
 * @returns {String} Suggestion text
 */
function getErrorSuggestion(errorMessage, fileType) {
  const message = errorMessage.toLowerCase();

  if (message.includes('json')) {
    if (message.includes('unexpected token')) {
      return 'Check for syntax errors like missing commas, brackets, or quotes in your JSON file';
    }
    if (message.includes('unexpected end')) {
      return 'Your JSON file appears to be incomplete. Ensure all brackets and braces are properly closed';
    }
    return 'Validate your JSON syntax using an online JSON validator before uploading';
  }

  if (message.includes('zip') || message.includes('archive')) {
    if (message.includes('empty')) {
      return 'Ensure your ZIP file contains the required config.json and Dockerfile files';
    }
    if (message.includes('config.json')) {
      return 'Your ZIP archive must contain a config.json file with challenge metadata';
    }
    if (message.includes('dockerfile')) {
      return 'Your ZIP archive must contain a Dockerfile to build the challenge container';
    }
    return 'Ensure your ZIP file contains both config.json and Dockerfile at the root level';
  }

  if (message.includes('empty')) {
    return 'The uploaded file appears to be empty. Please check the file and try again';
  }

  if (message.includes('too large') || message.includes('size')) {
    return 'Reduce the file size by removing unnecessary files or compressing images';
  }

  if (message.includes('challenge')) {
    return 'Ensure your file contains valid challenge definitions with required fields';
  }

  if (fileType === '.json') {
    return 'Verify your JSON file contains a valid challenge structure with required fields';
  }

  if (fileType === '.zip') {
    return 'Ensure your ZIP contains config.json with challenge metadata and Dockerfile for building';
  }

  return 'Check the file format and content, then try uploading again';
}

/**
 * Validate individual challenge for runtime use
 * @param {Object} challenge - Single challenge object
 * @returns {Object} Simple validation result
 */
function validateImportedChallenge(challenge) {
  return validateSingleChallenge(challenge);
}

module.exports = {
  validateImport,
  parseJSONFile,
  parseZIPFile,
  validateImportedChallenge,
  getErrorSuggestion
};