#!/usr/bin/env node

/**
 * Challenge Validation CLI Tool
 * Provides immediate validation feedback for challenge development
 */

const fs = require('fs');
const path = require('path');

// Import validation system
const {
  validateChallengeFile,
  validateSingleChallenge,
  generateValidationReport
} = require('../api/validation/validators');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

/**
 * Colorizes text for terminal output
 */
function colorize(text, color) {
  if (process.env.NO_COLOR || !process.stdout.isTTY) {
    return text;
  }
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Prints help message
 */
function printHelp() {
  console.log(`
${colorize('DVC Challenge Validator', 'cyan')}
${colorize('========================', 'cyan')}

Validates challenge definition files for security and compliance.

${colorize('USAGE:', 'bright')}
  node validate-challenge.js <challenge-file.json> [options]
  npm run validate <challenge-file.json> [options]

${colorize('OPTIONS:', 'bright')}
  -h, --help              Show this help message
  -q, --quiet             Suppress warnings and suggestions
  -v, --verbose           Show detailed validation information
  -j, --json              Output results in JSON format
  -s, --single            Validate as single challenge (not challenge file)
  --no-color              Disable colored output

${colorize('EXAMPLES:', 'bright')}
  node validate-challenge.js challenges/definitions/challenges.json
  node validate-challenge.js my-challenge.json --single
  node validate-challenge.js challenges.json --json --quiet

${colorize('EXIT CODES:', 'bright')}
  0  - Validation passed
  1  - Validation failed (errors found)
  2  - Invalid usage or file not found
`);
}

/**
 * Parses command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    help: false,
    quiet: false,
    verbose: false,
    json: false,
    single: false,
    noColor: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      case '-v':
      case '--verbose':
        options.verbose = true;
        break;
      case '-j':
      case '--json':
        options.json = true;
        break;
      case '-s':
      case '--single':
        options.single = true;
        break;
      case '--no-color':
        options.noColor = true;
        process.env.NO_COLOR = '1';
        break;
      default:
        if (!options.file && !arg.startsWith('-')) {
          options.file = arg;
        }
    }
  }

  return options;
}

/**
 * Reads and parses JSON file
 */
function readChallengeFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const data = JSON.parse(content);

    return { data, path: absolutePath };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON syntax in ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Formats validation results for console output
 */
function formatConsoleOutput(result, options) {
  const { valid, errors, warnings, suggestions, summary } = result;

  // Header
  console.log();
  console.log(colorize('🔍 Challenge Validation Results', 'cyan'));
  console.log(colorize('================================', 'cyan'));
  console.log();

  // Summary
  const statusIcon = valid ? '✅' : '❌';
  const statusText = valid ? 'VALID' : 'INVALID';
  const statusColor = valid ? 'green' : 'red';

  console.log(`Status: ${statusIcon} ${colorize(statusText, statusColor)}`);

  if (summary) {
    console.log(`Challenges: ${colorize(summary.validChallenges, 'green')}/${summary.totalChallenges} valid`);
    console.log(`Issues: ${colorize(summary.errorCount, 'red')} errors, ${colorize(summary.warningCount, 'yellow')} warnings`);
  }

  console.log();

  // Errors
  if (errors.length > 0) {
    console.log(colorize(`🚫 ERRORS (${errors.length}):`, 'red'));
    errors.forEach((error, i) => {
      console.log(`  ${colorize(i + 1 + '.', 'white')} ${colorize(`[${error.path}]`, 'magenta')} ${error.message}`);
      if (error.suggestion && !options.quiet) {
        console.log(`     ${colorize('💡 Fix:', 'cyan')} ${error.suggestion}`);
      }
    });
    console.log();
  }

  // Warnings
  if (warnings.length > 0 && !options.quiet) {
    console.log(colorize(`⚠️  WARNINGS (${warnings.length}):`, 'yellow'));
    warnings.forEach((warning, i) => {
      console.log(`  ${colorize(i + 1 + '.', 'white')} ${colorize(`[${warning.path}]`, 'magenta')} ${warning.message}`);
    });
    console.log();
  }

  // Suggestions
  if (suggestions.length > 0 && !options.quiet && options.verbose) {
    console.log(colorize(`💡 SUGGESTIONS (${suggestions.length}):`, 'blue'));
    suggestions.forEach((suggestion, i) => {
      console.log(`  ${colorize(i + 1 + '.', 'white')} ${colorize(`[${suggestion.path}]`, 'magenta')} ${suggestion.message}`);
    });
    console.log();
  }

  // Footer message
  if (valid) {
    console.log(colorize('🎉 All validations passed! Your challenge file is ready for import.', 'green'));
  } else {
    console.log(colorize('❌ Please fix the errors above before importing your challenge file.', 'red'));
  }

  if (!options.quiet && !valid) {
    console.log();
    console.log(colorize('Need help?', 'cyan'));
    console.log('• Check the documentation: /docs/challenge-development.md');
    console.log('• Review example challenges: /challenges/examples/');
    console.log('• Run with --verbose for more details');
  }

  console.log();
}

/**
 * Main execution function
 */
function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (!options.file) {
    console.error(colorize('❌ Error: No challenge file specified', 'red'));
    console.error('Use --help for usage information');
    process.exit(2);
  }

  try {
    // Read and parse file
    const { data, path: filePath } = readChallengeFile(options.file);

    if (options.verbose) {
      console.log(colorize(`📂 Validating: ${filePath}`, 'blue'));
    }

    // Perform validation
    let result;
    if (options.single) {
      result = validateSingleChallenge(data);
      result.summary = {
        totalChallenges: 1,
        validChallenges: result.valid ? 1 : 0,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      };
    } else {
      result = validateChallengeFile(data, {
        includeWarnings: !options.quiet,
        includeSuggestions: !options.quiet
      });
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      formatConsoleOutput(result, options);
    }

    // Exit with appropriate code
    process.exit(result.valid ? 0 : 1);

  } catch (error) {
    console.error(colorize(`❌ Error: ${error.message}`, 'red'));

    if (options.verbose) {
      console.error();
      console.error(colorize('Stack trace:', 'yellow'));
      console.error(error.stack);
    }

    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  main,
  parseArgs,
  readChallengeFile,
  formatConsoleOutput
};