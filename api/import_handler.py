"""
Challenge Import Handler
Provides endpoints for uploading and validating challenge files
"""

import os
import json
import tempfile
import zipfile
import re
import logging
import time
from typing import Dict, Any, List, Tuple
from flask import Blueprint, request, jsonify

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint
bp = Blueprint('import', __name__, url_prefix='/api/import')

# Validation constants
VALID_DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert']
VALID_CATEGORIES = ['web', 'crypto', 'reverse', 'pwn', 'forensics', 'misc', 'cloud', 'mobile', 'hardware']


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
    
    return {
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    }


def extract_config_from_zip(zip_path: str) -> Tuple[Dict[str, Any], str]:
    """
    Extract config.json from ZIP file
    
    Args:
        zip_path: Path to ZIP file
        
    Returns:
        Tuple of (config_data, config_filename)
    """
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # Look for config.json or challenge.json
        config_file = None
        for filename in zf.namelist():
            if filename.endswith('config.json') or filename.endswith('challenge.json'):
                config_file = filename
                break
        
        if not config_file:
            raise ValueError('No config.json or challenge.json found in ZIP file')
        
        # Extract and parse
        with zf.open(config_file) as f:
            config_data = json.load(f)
        
        return config_data, config_file


@bp.route('/', methods=['POST'])
def import_challenge():
    """
    Handle challenge file upload and validation
    
    Accepts:
        - JSON files: Direct challenge definition
        - ZIP files: Challenge package with config.json
        
    Returns:
        JSON response with validation results
    """
    logger.info("=== Import challenge endpoint called ===")
    try:
        # Check if file was uploaded
        logger.info(f"Request files: {list(request.files.keys())}")
        logger.info(f"Request form: {list(request.form.keys())}")
        
        if 'challengeFile' not in request.files:
            logger.error("No challengeFile in request.files")
            return jsonify({
                'success': False,
                'error': 'No file uploaded'
            }), 400
        
        file = request.files['challengeFile']
        logger.info(f"File received: {file.filename}")
        
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Get file extension
        filename = file.filename.lower()
        logger.info(f"Processing file: {filename}")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
            logger.info(f"Saved to temp file: {temp_path}")
        
        try:
            challenges = []
            
            if filename.endswith('.json'):
                logger.info("Processing JSON file")
                # Parse JSON file
                with open(temp_path, 'r') as f:
                    data = json.load(f)
                
                # Check format
                if 'challenges' in data and isinstance(data['challenges'], list):
                    challenges = data['challenges']
                    logger.info(f"Found {len(challenges)} challenges in array")
                elif 'id' in data and 'name' in data:
                    challenges = [data]
                    logger.info("Found single challenge")
                else:
                    logger.error("Invalid JSON format")
                    return jsonify({
                        'success': False,
                        'error': 'Invalid challenge format'
                    }), 400
            
            elif filename.endswith('.zip'):
                logger.info("Processing ZIP file")
                # Extract config from ZIP
                try:
                    config_data, config_filename = extract_config_from_zip(temp_path)
                    logger.info(f"Extracted config from: {config_filename}")
                    
                    if 'id' in config_data and 'name' in config_data:
                        challenges = [config_data]
                        logger.info(f"Valid challenge found with ID: {config_data['id']}")
                    else:
                        logger.error("Invalid config.json format")
                        return jsonify({
                            'success': False,
                            'error': 'Invalid challenge format in config.json'
                        }), 400
                        
                except ValueError as e:
                    logger.error(f"ZIP extraction error: {e}")
                    return jsonify({
                        'success': False,
                        'error': str(e)
                    }), 400
            else:
                logger.error(f"Unsupported file type: {filename}")
                return jsonify({
                    'success': False,
                    'error': 'Unsupported file type. Please upload a JSON or ZIP file.'
                }), 400
            
            logger.info(f"Starting validation of {len(challenges)} challenges")
            # Validate all challenges
            all_errors = []
            all_warnings = []
            valid_challenges = 0
            
            for idx, challenge in enumerate(challenges):
                logger.info(f"Validating challenge {idx}: {challenge.get('id', 'unknown')}")
                validation_result = validate_challenge(challenge)
                
                if validation_result['valid']:
                    valid_challenges += 1
                    logger.info(f"Challenge {idx} is valid")
                else:
                    logger.warning(f"Challenge {idx} has errors: {validation_result.get('errors', [])}")
                
                # Add errors with index
                for error in validation_result.get('errors', []):
                    all_errors.append({
                        **error,
                        'path': f'challenges[{idx}].{error.get("path", "")}'
                    })
                
                # Add warnings with index
                for warning in validation_result.get('warnings', []):
                    all_warnings.append({
                        **warning,
                        'path': f'challenges[{idx}].{warning.get("path", "")}'
                    })
            
            # Build response
            has_errors = len(all_errors) > 0
            logger.info(f"Validation complete: errors={len(all_errors)}, warnings={len(all_warnings)}")
            
            # If validation passed, save challenges to imported challenges file
            if not has_errors:
                logger.info("Saving challenges to imported file")
                import_dir = '/app/data/imported'
                os.makedirs(import_dir, exist_ok=True)
                
                # For ZIP files, extract all contents for building
                challenge_build_path = None
                if filename.endswith('.zip'):
                    # Extract ZIP to a directory named after the challenge ID
                    challenge_id = challenges[0].get('id')
                    extract_dir = os.path.join(import_dir, challenge_id)
                    os.makedirs(extract_dir, exist_ok=True)
                    
                    logger.info(f"Extracting ZIP to {extract_dir}")
                    with zipfile.ZipFile(temp_path, 'r') as zf:
                        zf.extractall(extract_dir)
                    
                    challenge_build_path = extract_dir
                    logger.info(f"Extracted challenge files to {extract_dir}")
                
                # Add build path to challenge metadata
                for challenge in challenges:
                    challenge['imported'] = True
                    challenge['import_source'] = 'user_upload'
                    challenge['imported_at'] = time.time()
                    if challenge_build_path:
                        challenge['build_context'] = challenge_build_path
                
                import_file = os.path.join(import_dir, 'imported_challenges.json')
                
                # Load existing imported challenges
                existing_challenges = []
                if os.path.exists(import_file):
                    try:
                        with open(import_file, 'r') as f:
                            data = json.load(f)
                            existing_challenges = data.get('challenges', [])
                        logger.info(f"Loaded {len(existing_challenges)} existing challenges")
                    except Exception as e:
                        logger.warning(f"Failed to load existing challenges: {e}")
                
                # Add new challenges (avoid duplicates by ID)
                existing_ids = {c.get('id') for c in existing_challenges}
                for challenge in challenges:
                    if challenge.get('id') not in existing_ids:
                        existing_challenges.append(challenge)
                        logger.info(f"Added challenge: {challenge.get('id')}")
                    else:
                        logger.info(f"Skipped duplicate: {challenge.get('id')}")
                
                # Save updated list
                with open(import_file, 'w') as f:
                    json.dump({'challenges': existing_challenges}, f, indent=2)
                logger.info(f"Saved {len(existing_challenges)} total challenges to {import_file}")
                
                # Reload challenges in orchestrator to pick up new imports
                try:
                    from challenges import get_orchestrator
                    orchestrator = get_orchestrator()
                    orchestrator.reload_challenges()
                    logger.info("Reloaded challenges in orchestrator")
                except Exception as e:
                    logger.warning(f"Failed to reload orchestrator: {e}")
            
            response_data = {
                'success': not has_errors,
                'data': {
                    'challenges': challenges if not has_errors else [],
                    'validationResult': {
                        'valid': not has_errors,
                        'summary': {
                            'totalChallenges': len(challenges),
                            'validChallenges': valid_challenges,
                            'errorCount': len(all_errors),
                            'warningCount': len(all_warnings)
                        },
                        'errors': all_errors,
                        'warnings': all_warnings
                    }
                }
            }
            logger.info(f"Returning response: success={not has_errors}")
            return jsonify(response_data)
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except json.JSONDecodeError as e:
        logger.error(f'JSON decode error: {e}')
        return jsonify({
            'success': False,
            'error': f'Invalid JSON: {str(e)}'
        }), 400
    
    except Exception as e:
        logger.error(f'Import error: {e}', exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to process upload: {str(e)}'
        }), 500


@bp.route('/<challenge_id>', methods=['DELETE'])
def delete_imported_challenge(challenge_id: str):
    """
    Delete an imported challenge
    
    Args:
        challenge_id: ID of the challenge to delete
        
    Returns:
        JSON response with deletion status
    """
    logger.info(f"=== Delete imported challenge: {challenge_id} ===")
    try:
        # Get imported challenges directory
        imported_dir = os.environ.get('IMPORTED_CHALLENGES_DIR', '/app/data/imported')
        imported_json_path = os.path.join(imported_dir, 'imported_challenges.json')
        
        # Load imported challenges
        imported_data = {'challenges': []}
        if os.path.exists(imported_json_path):
            with open(imported_json_path, 'r') as f:
                content = json.load(f)
                # Handle both formats: {'challenges': [...]} or [...]
                if isinstance(content, dict) and 'challenges' in content:
                    imported_data = content
                elif isinstance(content, list):
                    imported_data = {'challenges': content}
        
        # Find and remove the challenge
        challenge_found = False
        updated_challenges = []
        challenge_dir = None
        
        for challenge in imported_data.get('challenges', []):
            if challenge.get('id') == challenge_id:
                challenge_found = True
                challenge_dir = challenge.get('build_context')
                logger.info(f"Found challenge to delete: {challenge.get('name')}")
            else:
                updated_challenges.append(challenge)
        
        if not challenge_found:
            logger.warning(f"Challenge not found: {challenge_id}")
            return jsonify({
                'success': False,
                'error': 'Challenge not found'
            }), 404
        
        # Save updated challenges list
        with open(imported_json_path, 'w') as f:
            json.dump({'challenges': updated_challenges}, f, indent=2)
        
        # Delete challenge directory if it exists
        if challenge_dir and os.path.exists(challenge_dir):
            import shutil
            shutil.rmtree(challenge_dir)
            logger.info(f"Deleted challenge directory: {challenge_dir}")
        
        # Reload challenges in orchestrator
        try:
            from challenges import get_orchestrator
            orchestrator = get_orchestrator()
            orchestrator.reload_challenges()
            logger.info("Reloaded challenges in orchestrator")
        except Exception as e:
            logger.warning(f"Failed to reload orchestrator: {e}")
        
        logger.info(f"Successfully deleted challenge: {challenge_id}")
        return jsonify({
            'success': True,
            'message': 'Challenge deleted successfully'
        })
    
    except Exception as e:
        logger.error(f'Delete error: {e}', exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to delete challenge: {str(e)}'
        }), 500
