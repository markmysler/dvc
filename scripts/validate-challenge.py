#!/usr/bin/env python3

"""
Challenge Validation CLI Tool
Provides immediate validation feedback for challenge development
"""

import sys
import os
import json
import argparse
import re
from typing import Dict, Any, List, Tuple

# Add parent directory to path to import validation logic
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Validation constants
VALID_DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert']
VALID_CATEGORIES = ['web', 'crypto', 'reverse', 'pwn', 'forensics', 'misc', 'cloud', 'mobile', 'hardware']

# ANSI color codes for terminal output
class Colors:
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'
    BRIGHT = '\033[1m'
    RESET = '\033[0m'


def colorize(text: str, color: str) -> str:
    """Colorize text for terminal output"""
    if os.environ.get('NO_COLOR') or not sys.stdout.isatty():
        return text
    
    color_code = getattr(Colors, color.upper(), '')
    return f"{color_code}{text}{Colors.RESET}"


def validate_challenge(challenge: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate challenge data structure and content
    
    Args:
        challenge: Challenge data to validate
        
    Returns:
        Validation result with errors and warnings
    """
    errors = []
    warnings = []
    
    # Required fields validation
    required_fields = {
        'id': str,
        'name': str,
        'description': str,
        'difficulty': str,
        'category': str,
        'points': int
    }
    
    for field, expected_type in required_fields.items():
        if field not in challenge:
            errors.append({
                'path': field,
                'message': f'Missing required field: {field}',
                'suggestion': f'Add the "{field}" field to your challenge',
                'severity': 'error'
            })
        elif not isinstance(challenge[field], expected_type):
            errors.append({
                'path': field,
                'message': f'Expected {expected_type.__name__} but got {type(challenge[field]).__name__} for {field}',
                'suggestion': f'Change the value to a {expected_type.__name__}',
                'severity': 'error'
            })
    
    # Validate ID format
    if 'id' in challenge and isinstance(challenge['id'], str):
        if not re.match(r'^[a-z0-9-]+$', challenge['id']):
            errors.append({
                'path': 'id',
                'message': 'Invalid ID format',
                'suggestion': 'IDs should be lowercase with hyphens, like "web-basic-xss"',
                'severity': 'error'
            })
    
    # Validate difficulty
    if 'difficulty' in challenge and isinstance(challenge['difficulty'], str):
        if challenge['difficulty'].lower() not in VALID_DIFFICULTIES:
            errors.append({
                'path': 'difficulty',
                'message': f'Invalid difficulty value: {challenge["difficulty"]}',
                'suggestion': f'Use one of: {", ".join(VALID_DIFFICULTIES)}',
                'severity': 'error'
            })
    
    # Validate category
    if 'category' in challenge and isinstance(challenge['category'], str):
        if challenge['category'].lower() not in VALID_CATEGORIES:
            warnings.append({
                'path': 'category',
                'message': f'Non-standard category: {challenge["category"]}',
                'severity': 'warning'
            })
    
    # Validate points range
    if 'points' in challenge and isinstance(challenge['points'], int):
        if challenge['points'] < 0 or challenge['points'] > 10000:
            warnings.append({
                'path': 'points',
                'message': 'Points value seems unusual (should be between 0-10000)',
                'severity': 'warning'
            })
    
    # Validate description length
    if 'description' in challenge and isinstance(challenge['description'], str):
        if len(challenge['description']) < 10:
            warnings.append({
                'path': 'description',
                'message': 'Description is very short',
                'severity': 'warning'
            })
    
    # Validate container_spec if present
    if 'container_spec' in challenge:
        container_spec = challenge['container_spec']
        if not isinstance(container_spec, dict):
            errors.append({
                'path': 'container_spec',
                'message': 'container_spec must be an object',
                'suggestion': 'Provide a valid container specification object',
                'severity': 'error'
            })
        elif 'image' not in container_spec:
            errors.append({
                'path': 'container_spec.image',
                'message': 'Missing required container_spec.image field',
                'suggestion': 'Add the "image" field to container_spec',
                'severity': 'error'
            })
    
    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }


def validate_challenge_file(data: Dict[str, Any], options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a challenge file containing one or more challenges
    
    Args:
        data: Parsed JSON data
        options: Validation options
        
    Returns:
        Validation result with summary
    """
    all_errors = []
    all_warnings = []
    valid_challenges = 0
    
    # Handle both formats: {'challenges': [...]} or single challenge
    if isinstance(data, dict) and 'challenges' in data:
        challenges = data['challenges']
    elif isinstance(data, list):
        challenges = data
    elif isinstance(data, dict) and 'id' in data:
        challenges = [data]
    else:
        return {
            'valid': False,
            'errors': [{'path': 'root', 'message': 'Invalid challenge file format', 'severity': 'error'}],
            'warnings': [],
            'summary': {'totalChallenges': 0, 'validChallenges': 0, 'errorCount': 1, 'warningCount': 0}
        }
    
    # Validate each challenge
    for i, challenge in enumerate(challenges):
        result = validate_challenge(challenge)
        
        if result['valid']:
            valid_challenges += 1
        
        # Add challenge index to error paths
        for error in result['errors']:
            error['path'] = f"challenges[{i}].{error['path']}"
            all_errors.append(error)
        
        if options.get('include_warnings', True):
            for warning in result['warnings']:
                warning['path'] = f"challenges[{i}].{warning['path']}"
                all_warnings.append(warning)
    
    return {
        'valid': len(all_errors) == 0,
        'errors': all_errors,
        'warnings': all_warnings,
        'summary': {
            'totalChallenges': len(challenges),
            'validChallenges': valid_challenges,
            'errorCount': len(all_errors),
            'warningCount': len(all_warnings)
        }
    }


def format_console_output(result: Dict[str, Any], options: argparse.Namespace) -> None:
    """Format validation results for console output"""
    valid = result['valid']
    errors = result.get('errors', [])
    warnings = result.get('warnings', [])
    summary = result.get('summary', {})
    
    # Header
    print()
    print(colorize('🔍 Challenge Validation Results', 'cyan'))
    print(colorize('================================', 'cyan'))
    print()
    
    # Summary
    status_icon = '✅' if valid else '❌'
    status_text = 'VALID' if valid else 'INVALID'
    status_color = 'green' if valid else 'red'
    
    print(f"Status: {status_icon} {colorize(status_text, status_color)}")
    
    if summary:
        print(f"Challenges: {colorize(str(summary['validChallenges']), 'green')}/{summary['totalChallenges']} valid")
        print(f"Issues: {colorize(str(summary['errorCount']), 'red')} errors, {colorize(str(summary['warningCount']), 'yellow')} warnings")
    
    print()
    
    # Errors
    if errors:
        print(colorize(f'🚫 ERRORS ({len(errors)}):', 'red'))
        for i, error in enumerate(errors):
            error_path = error['path']
            error_msg = error['message']
            print(f"  {colorize(f'{i + 1}.', 'white')} {colorize(f'[{error_path}]', 'magenta')} {error_msg}")
            if error.get('suggestion') and not options.quiet:
                suggestion = error['suggestion']
                print(f"     {colorize('💡 Fix:', 'cyan')} {suggestion}")
        print()
    
    # Warnings
    if warnings and not options.quiet:
        print(colorize(f'⚠️  WARNINGS ({len(warnings)}):', 'yellow'))
        for i, warning in enumerate(warnings):
            warning_path = warning['path']
            warning_msg = warning['message']
            print(f"  {colorize(f'{i + 1}.', 'white')} {colorize(f'[{warning_path}]', 'magenta')} {warning_msg}")
        print()
    
    # Footer message
    if valid:
        print(colorize('🎉 All validations passed! Your challenge file is ready for import.', 'green'))
    else:
        print(colorize('❌ Please fix the errors above before importing your challenge file.', 'red'))
    
    if not options.quiet and not valid:
        print()
        print(colorize('Need help?', 'cyan'))
        print('• Check the documentation: /docs/challenge-development.md')
        print('• Review example challenges: /challenges/examples/')
        print('• Run with --verbose for more details')
    
    print()


def read_challenge_file(file_path: str) -> Tuple[Dict[str, Any], str]:
    """Read and parse JSON file"""
    try:
        abs_path = os.path.abspath(file_path)
        
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        with open(abs_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return data, abs_path
    
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON syntax in {file_path}: {str(e)}")


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description='Validates challenge definition files for security and compliance.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:
  python validate-challenge.py challenges/definitions/challenges.json
  python validate-challenge.py my-challenge.json --single
  python validate-challenge.py challenges.json --json --quiet

EXIT CODES:
  0  - Validation passed
  1  - Validation failed (errors found)
  2  - Invalid usage or file not found
        """
    )
    
    parser.add_argument('file', help='Challenge file to validate')
    parser.add_argument('-q', '--quiet', action='store_true', 
                        help='Suppress warnings and suggestions')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='Show detailed validation information')
    parser.add_argument('-j', '--json', action='store_true',
                        help='Output results in JSON format')
    parser.add_argument('-s', '--single', action='store_true',
                        help='Validate as single challenge (not challenge file)')
    parser.add_argument('--no-color', action='store_true',
                        help='Disable colored output')
    
    args = parser.parse_args()
    
    if args.no_color:
        os.environ['NO_COLOR'] = '1'
    
    try:
        # Read and parse file
        data, file_path = read_challenge_file(args.file)
        
        if args.verbose:
            print(colorize(f'📂 Validating: {file_path}', 'blue'))
        
        # Perform validation
        if args.single:
            result = validate_challenge(data)
            result['summary'] = {
                'totalChallenges': 1,
                'validChallenges': 1 if result['valid'] else 0,
                'errorCount': len(result['errors']),
                'warningCount': len(result['warnings'])
            }
        else:
            result = validate_challenge_file(data, {
                'include_warnings': not args.quiet
            })
        
        # Output results
        if args.json:
            print(json.dumps(result, indent=2))
        else:
            format_console_output(result, args)
        
        # Exit with appropriate code
        sys.exit(0 if result['valid'] else 1)
    
    except (FileNotFoundError, ValueError) as e:
        print(colorize(f'❌ Error: {str(e)}', 'red'), file=sys.stderr)
        
        if args.verbose:
            import traceback
            print(file=sys.stderr)
            print(colorize('Stack trace:', 'yellow'), file=sys.stderr)
            traceback.print_exc()
        
        sys.exit(2)
    
    except Exception as e:
        print(colorize(f'❌ Unexpected error: {str(e)}', 'red'), file=sys.stderr)
        
        if args.verbose:
            import traceback
            print(file=sys.stderr)
            print(colorize('Stack trace:', 'yellow'), file=sys.stderr)
            traceback.print_exc()
        
        sys.exit(2)


if __name__ == '__main__':
    main()
