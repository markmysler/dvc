// Main Validation Orchestrator
// Compiles AJV schemas and orchestrates validation pipeline

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { challengeSchema, singleChallengeSchema } = require('./schemas/challenge-schema');
const {
  validateContainerSecurity,
  validateChallengeSecurityComplete,
  generateSecurityRecommendations
} = require('./security/container-security');

/**
 * Initialize AJV with schemas and formats
 */
function createValidator() {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: true,
    allowUnionTypes: true
  });

  // Add format validators
  addFormats(ajv);

  // Compile schemas for performance
  const validateChallengeFile = ajv.compile(challengeSchema);
  const validateSingleChallenge = ajv.compile(singleChallengeSchema);

  return {
    validateChallengeFile,
    validateSingleChallenge,
    ajv
  };
}

/**
 * Converts AJV errors to user-friendly format
 * @param {Array} ajvErrors - AJV validation errors
 * @returns {Array} Formatted error objects
 */
function formatValidationErrors(ajvErrors) {
  if (!ajvErrors) return [];

  return ajvErrors.map(error => {
    const path = error.instancePath || error.dataPath || '';
    const value = error.data;

    let message = error.message;
    let suggestion = '';

    // Provide specific suggestions based on error type
    switch (error.keyword) {
      case 'required':
        message = `Missing required field: ${error.params.missingProperty}`;
        suggestion = `Add the "${error.params.missingProperty}" field to your ${path || 'object'}`;
        break;

      case 'pattern':
        message = `Invalid format for ${path}: ${message}`;
        if (path.includes('id')) {
          suggestion = 'IDs should be lowercase with hyphens, like "web-basic-xss"';
        } else if (path.includes('image')) {
          suggestion = 'Image names should follow Docker naming conventions';
        } else if (path.includes('port')) {
          suggestion = 'Ports should be numbers between 1 and 65535';
        } else {
          suggestion = 'Check the format requirements for this field';
        }
        break;

      case 'enum':
        message = `Invalid value "${value}" for ${path}`;
        suggestion = `Allowed values: ${error.params.allowedValues.join(', ')}`;
        break;

      case 'type':
        message = `Expected ${error.params.type} but got ${typeof value} for ${path}`;
        suggestion = `Change the value to a ${error.params.type}`;
        break;

      case 'minLength':
        message = `${path} is too short (minimum ${error.params.limit} characters)`;
        suggestion = `Provide a longer value (at least ${error.params.limit} characters)`;
        break;

      case 'maxLength':
        message = `${path} is too long (maximum ${error.params.limit} characters)`;
        suggestion = `Shorten the value to ${error.params.limit} characters or less`;
        break;

      case 'minimum':
        message = `${path} is too small (minimum ${error.params.limit})`;
        suggestion = `Use a value of ${error.params.limit} or higher`;
        break;

      case 'maximum':
        message = `${path} is too large (maximum ${error.params.limit})`;
        suggestion = `Use a value of ${error.params.limit} or lower`;
        break;

      case 'additionalProperties':
        message = `Unknown property "${error.params.additionalProperty}" in ${path}`;
        suggestion = 'Remove this property or check for typos in the property name';
        break;

      case 'const':
        if (path.includes('privileged')) {
          message = 'Privileged mode is forbidden for security';
          suggestion = 'Remove the "privileged" property or set it to false';
        } else {
          message = `${path} must be exactly: ${error.params.allowedValue}`;
          suggestion = `Change the value to ${error.params.allowedValue}`;
        }
        break;

      default:
        suggestion = 'Check the schema documentation for requirements';
    }

    return {
      path: path || 'root',
      message,
      suggestion,
      value,
      severity: 'error'
    };
  });
}

/**
 * Validates a complete challenge file with comprehensive error reporting
 * @param {Object} challengeData - Parsed challenge JSON
 * @param {Object} options - Validation options
 * @returns {Object} Comprehensive validation result
 */
function validateChallengeFile(challengeData, options = {}) {
  const { includeWarnings = true, includeSuggestions = true } = options;

  const validator = createValidator();
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    suggestions: [],
    summary: {
      totalChallenges: 0,
      validChallenges: 0,
      errorCount: 0,
      warningCount: 0
    }
  };

  // Schema validation
  const schemaValid = validator.validateChallengeFile(challengeData);
  if (!schemaValid) {
    const formattedErrors = formatValidationErrors(validator.validateChallengeFile.errors);
    result.errors.push(...formattedErrors);
  }

  if (!challengeData.challenges) {
    result.errors.push({
      path: 'root',
      message: 'No challenges array found',
      suggestion: 'Add a "challenges" array with at least one challenge',
      severity: 'error'
    });
    return result;
  }

  result.summary.totalChallenges = challengeData.challenges.length;

  // Validate each challenge
  challengeData.challenges.forEach((challenge, index) => {
    const challengePath = `challenges[${index}]`;

    // Individual challenge schema validation
    const challengeValid = validator.validateSingleChallenge(challenge);
    if (!challengeValid) {
      const formattedErrors = formatValidationErrors(validator.validateSingleChallenge.errors);
      formattedErrors.forEach(error => {
        error.path = `${challengePath}.${error.path}`.replace('.root', '');
        result.errors.push(error);
      });
    }

    // Security validation
    const securityResult = validateChallengeSecurityComplete(challenge);
    if (securityResult.errors.length > 0) {
      securityResult.errors.forEach(message => {
        result.errors.push({
          path: `${challengePath}.container_spec`,
          message,
          suggestion: '',
          severity: 'error'
        });
      });
    }

    if (includeWarnings && securityResult.warnings.length > 0) {
      securityResult.warnings.forEach(message => {
        result.warnings.push({
          path: `${challengePath}.container_spec`,
          message,
          suggestion: '',
          severity: 'warning'
        });
      });
    }

    if (includeSuggestions && securityResult.suggestions.length > 0) {
      securityResult.suggestions.forEach(suggestion => {
        result.suggestions.push({
          path: `${challengePath}.container_spec`,
          message: suggestion,
          severity: 'suggestion'
        });
      });
    }

    // Additional validation checks
    if (challenge.id) {
      // Check for duplicate IDs
      const duplicates = challengeData.challenges.filter(c => c.id === challenge.id);
      if (duplicates.length > 1) {
        result.errors.push({
          path: `${challengePath}.id`,
          message: `Duplicate challenge ID: ${challenge.id}`,
          suggestion: 'Each challenge must have a unique ID',
          severity: 'error'
        });
      }
    }

    // Increment valid challenges counter if no errors for this challenge
    const challengeErrors = result.errors.filter(e => e.path.startsWith(challengePath));
    if (challengeErrors.length === 0) {
      result.summary.validChallenges++;
    }
  });

  // Update summary
  result.summary.errorCount = result.errors.length;
  result.summary.warningCount = result.warnings.length;
  result.valid = result.errors.length === 0;

  return result;
}

/**
 * Quick validation for individual challenge during runtime
 * @param {Object} challenge - Single challenge object
 * @returns {Object} Simple validation result
 */
function validateSingleChallenge(challenge) {
  const validator = createValidator();

  const schemaValid = validator.validateSingleChallenge(challenge);
  const securityResult = validateChallengeSecurityComplete(challenge);

  const errors = [];

  if (!schemaValid) {
    const formattedErrors = formatValidationErrors(validator.validateSingleChallenge.errors);
    errors.push(...formattedErrors);
  }

  errors.push(...securityResult.errors.map(message => ({
    path: 'container_spec',
    message,
    suggestion: '',
    severity: 'error'
  })));

  return {
    valid: errors.length === 0,
    errors,
    warnings: securityResult.warnings.map(message => ({
      path: 'container_spec',
      message,
      severity: 'warning'
    }))
  };
}

/**
 * Generates a validation report with fix suggestions
 * @param {Object} validationResult - Result from validateChallengeFile
 * @returns {String} Formatted validation report
 */
function generateValidationReport(validationResult) {
  const { valid, errors, warnings, suggestions, summary } = validationResult;

  let report = `\n=== Challenge Validation Report ===\n\n`;

  report += `Status: ${valid ? '✅ VALID' : '❌ INVALID'}\n`;
  report += `Challenges: ${summary.validChallenges}/${summary.totalChallenges} valid\n`;
  report += `Issues: ${summary.errorCount} errors, ${summary.warningCount} warnings\n\n`;

  if (errors.length > 0) {
    report += `🚫 ERRORS (${errors.length}):\n`;
    errors.forEach((error, i) => {
      report += `  ${i + 1}. [${error.path}] ${error.message}\n`;
      if (error.suggestion) {
        report += `     💡 Fix: ${error.suggestion}\n`;
      }
    });
    report += '\n';
  }

  if (warnings.length > 0) {
    report += `⚠️  WARNINGS (${warnings.length}):\n`;
    warnings.forEach((warning, i) => {
      report += `  ${i + 1}. [${warning.path}] ${warning.message}\n`;
    });
    report += '\n';
  }

  if (suggestions.length > 0) {
    report += `💡 SUGGESTIONS (${suggestions.length}):\n`;
    suggestions.forEach((suggestion, i) => {
      report += `  ${i + 1}. [${suggestion.path}] ${suggestion.message}\n`;
    });
    report += '\n';
  }

  if (valid) {
    report += '🎉 All validations passed! Your challenge file is ready for import.\n';
  } else {
    report += '❌ Please fix the errors above before importing your challenge file.\n';
  }

  return report;
}

module.exports = {
  createValidator,
  validateChallengeFile,
  validateSingleChallenge,
  formatValidationErrors,
  generateValidationReport
};