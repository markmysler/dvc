#!/usr/bin/env python3
"""
Configuration Manager

Unified configuration management system for challenges with inheritance and merging.
Eliminates duplicate config.json files and provides single source of truth.
"""

import json
import os
import logging
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)

class ConfigurationError(Exception):
    """Base exception for configuration management errors"""
    pass

class ConfigManager:
    """
    Unified configuration management system for challenges

    Provides single source of truth for challenge configurations with:
    - Configuration inheritance and merging
    - Individual challenge config overrides (for transition period)
    - Fallback logic for backward compatibility
    - Configuration validation and error handling
    - Caching for performance
    """

    def __init__(self,
                 master_config_path: str = "challenges/definitions/challenges.json",
                 challenges_base_path: str = "challenges"):
        """
        Initialize the configuration manager

        Args:
            master_config_path: Path to master challenges configuration
            challenges_base_path: Base path for individual challenge directories
        """
        self.master_config_path = Path(master_config_path)
        self.challenges_base_path = Path(challenges_base_path)
        self.imported_config_path = Path('/app/data/imported/imported_challenges.json')

        # Configuration cache
        self._config_cache: Dict[str, Dict] = {}
        self._cache_timestamp: Optional[float] = None
        self._master_config: Dict = {}
        self._imported_config: Dict = {}

        # Load initial configuration
        self.reload_configurations()

    def reload_configurations(self) -> None:
        """Refresh configuration cache by reloading all config sources"""
        try:
            logger.info("Reloading configuration cache...")

            # Clear cache
            self._config_cache.clear()
            self._cache_timestamp = datetime.now().timestamp()

            # Load master configuration
            self._load_master_config()

            # Load imported configuration if exists
            self._load_imported_config()

            # Build unified cache
            self._build_config_cache()

            logger.info(f"Configuration cache reloaded with {len(self._config_cache)} challenges")

        except Exception as e:
            logger.error(f"Failed to reload configurations: {e}")
            raise ConfigurationError(f"Configuration reload failed: {e}")

    def _load_master_config(self) -> None:
        """Load master configuration from challenges.json"""
        try:
            if not self.master_config_path.exists():
                logger.warning(f"Master config file not found: {self.master_config_path}")
                self._master_config = {"schema_version": "1.0", "challenges": []}
                return

            with open(self.master_config_path, 'r') as f:
                self._master_config = json.load(f)

            # Validate structure
            if 'challenges' not in self._master_config:
                raise ConfigurationError("Master config missing 'challenges' key")

            logger.info(f"Loaded master config with {len(self._master_config['challenges'])} challenges")

        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Failed to load master config: {e}")
            raise ConfigurationError(f"Master config loading failed: {e}")

    def _load_imported_config(self) -> None:
        """Load imported configuration if exists"""
        try:
            if not self.imported_config_path.exists():
                logger.debug("No imported config file found")
                self._imported_config = {"challenges": []}
                return

            with open(self.imported_config_path, 'r') as f:
                self._imported_config = json.load(f)

            # Ensure challenges key exists
            if 'challenges' not in self._imported_config:
                self._imported_config['challenges'] = []

            logger.info(f"Loaded imported config with {len(self._imported_config['challenges'])} challenges")

        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.warning(f"Failed to load imported config: {e}")
            self._imported_config = {"challenges": []}

    def _build_config_cache(self) -> None:
        """Build unified configuration cache from all sources"""
        # Add challenges from master config
        for challenge in self._master_config.get('challenges', []):
            challenge_id = challenge.get('id')
            if challenge_id:
                self._config_cache[challenge_id] = challenge.copy()

        # Add challenges from imported config (overwrites if same ID)
        for challenge in self._imported_config.get('challenges', []):
            challenge_id = challenge.get('id')
            if challenge_id:
                self._config_cache[challenge_id] = challenge.copy()

        # Check for individual config files (backward compatibility)
        self._load_individual_configs()

    def _load_individual_configs(self) -> None:
        """Load individual config.json files for backward compatibility"""
        if not self.challenges_base_path.exists():
            return

        for challenge_dir in self.challenges_base_path.iterdir():
            if not challenge_dir.is_dir():
                continue

            config_file = challenge_dir / 'config.json'
            if not config_file.exists():
                continue

            try:
                with open(config_file, 'r') as f:
                    individual_config = json.load(f)

                challenge_id = individual_config.get('id')
                if challenge_id:
                    # Only use individual config if not in unified config
                    if challenge_id not in self._config_cache:
                        logger.info(f"Loading individual config for {challenge_id} (not in unified config)")
                        self._config_cache[challenge_id] = individual_config
                    else:
                        logger.debug(f"Skipping individual config for {challenge_id} (exists in unified config)")

            except Exception as e:
                logger.warning(f"Failed to load individual config {config_file}: {e}")

    def get_challenge_config(self, challenge_id: str) -> Dict[str, Any]:
        """
        Get unified configuration for a specific challenge

        Args:
            challenge_id: ID of the challenge

        Returns:
            Complete challenge configuration dictionary

        Raises:
            ConfigurationError: If challenge not found or config invalid
        """
        try:
            if challenge_id not in self._config_cache:
                # Try reloading in case configuration was updated
                self.reload_configurations()

                if challenge_id not in self._config_cache:
                    raise ConfigurationError(f"Challenge configuration not found: {challenge_id}")

            config = self._config_cache[challenge_id].copy()

            # Validate configuration before returning
            if not self.validate_configuration(config):
                raise ConfigurationError(f"Invalid configuration for challenge: {challenge_id}")

            return config

        except Exception as e:
            logger.error(f"Error getting config for {challenge_id}: {e}")
            raise ConfigurationError(f"Failed to get challenge config: {e}")

    def list_available_challenges(self) -> List[str]:
        """
        Get list of all available challenge IDs

        Returns:
            List of challenge IDs from all configuration sources
        """
        return list(self._config_cache.keys())

    def validate_configuration(self, config: Dict[str, Any]) -> bool:
        """
        Validate challenge configuration structure

        Args:
            config: Challenge configuration dictionary

        Returns:
            True if configuration is valid, False otherwise
        """
        try:
            # Required top-level fields
            required_fields = ['id', 'name', 'description', 'difficulty', 'category', 'container_spec']
            for field in required_fields:
                if field not in config:
                    logger.error(f"Missing required field in config: {field}")
                    return False

            # Validate container_spec structure
            container_spec = config.get('container_spec', {})
            if 'image' not in container_spec:
                logger.error("Missing 'image' in container_spec")
                return False

            # Validate required metadata if present
            metadata = config.get('metadata', {})
            if metadata and 'hints' in metadata:
                hints = metadata['hints']
                if not isinstance(hints, list):
                    logger.error("Hints must be a list")
                    return False

            return True

        except Exception as e:
            logger.error(f"Configuration validation error: {e}")
            return False

    def get_challenge_list_with_metadata(self) -> List[Dict[str, Any]]:
        """
        Get list of all challenges with basic metadata for discovery interface

        Returns:
            List of challenge info dictionaries with basic metadata
        """
        challenges = []

        for challenge_id in self.list_available_challenges():
            try:
                config = self.get_challenge_config(challenge_id)

                challenge_info = {
                    'id': challenge_id,
                    'name': config.get('name', 'Unknown'),
                    'description': config.get('description', ''),
                    'difficulty': config.get('difficulty', 'unknown'),
                    'category': config.get('category', 'misc'),
                    'points': config.get('points', 0),
                    'tags': config.get('tags', []),
                    'estimated_time': config.get('metadata', {}).get('estimated_time', 'Unknown'),
                    'learning_objectives': config.get('metadata', {}).get('learning_objectives', [])
                }

                challenges.append(challenge_info)

            except Exception as e:
                logger.warning(f"Error processing challenge {challenge_id}: {e}")

        return challenges

    def _merge_configurations(self, base_config: Dict[str, Any],
                            override_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge configuration dictionaries with override precedence

        Args:
            base_config: Base configuration dictionary
            override_config: Override configuration dictionary

        Returns:
            Merged configuration dictionary
        """
        merged = base_config.copy()

        for key, value in override_config.items():
            if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                merged[key] = self._merge_configurations(merged[key], value)
            else:
                # Override value
                merged[key] = value

        return merged

    def get_config_source_info(self) -> Dict[str, Any]:
        """
        Get information about configuration sources and cache status

        Returns:
            Dictionary with configuration source information
        """
        return {
            'master_config_path': str(self.master_config_path),
            'master_config_exists': self.master_config_path.exists(),
            'imported_config_path': str(self.imported_config_path),
            'imported_config_exists': self.imported_config_path.exists(),
            'challenges_base_path': str(self.challenges_base_path),
            'cache_size': len(self._config_cache),
            'cache_timestamp': self._cache_timestamp,
            'available_challenges': self.list_available_challenges()
        }

    def migrate_individual_config(self, challenge_id: str,
                                individual_config_path: str) -> Dict[str, Any]:
        """
        Migrate an individual config.json to unified configuration format

        Args:
            challenge_id: ID of the challenge
            individual_config_path: Path to individual config.json

        Returns:
            Migrated configuration ready for unified storage

        Raises:
            ConfigurationError: If migration fails
        """
        try:
            config_path = Path(individual_config_path)
            if not config_path.exists():
                raise ConfigurationError(f"Individual config not found: {config_path}")

            with open(config_path, 'r') as f:
                individual_config = json.load(f)

            # Validate configuration
            if not self.validate_configuration(individual_config):
                raise ConfigurationError(f"Invalid individual configuration: {challenge_id}")

            # Ensure ID matches
            if individual_config.get('id') != challenge_id:
                logger.warning(f"ID mismatch in config: expected {challenge_id}, got {individual_config.get('id')}")
                individual_config['id'] = challenge_id

            # Add migration metadata
            if 'metadata' not in individual_config:
                individual_config['metadata'] = {}

            individual_config['metadata']['migration'] = {
                'migrated_from': str(config_path),
                'migrated_at': datetime.now().isoformat(),
                'migration_tool': 'config_manager'
            }

            return individual_config

        except Exception as e:
            logger.error(f"Failed to migrate config for {challenge_id}: {e}")
            raise ConfigurationError(f"Configuration migration failed: {e}")


def load_merged_challenge_config(challenge_id: str,
                               master_config_path: str = "challenges/definitions/challenges.json") -> Dict[str, Any]:
    """
    Convenience function to load a single challenge configuration with inheritance

    Args:
        challenge_id: ID of challenge to load
        master_config_path: Path to master configuration file

    Returns:
        Complete challenge configuration dictionary

    Raises:
        ConfigurationError: If challenge not found or config invalid
    """
    config_manager = ConfigManager(master_config_path=master_config_path)
    return config_manager.get_challenge_config(challenge_id)


if __name__ == "__main__":
    # CLI interface for testing
    import sys

    if len(sys.argv) < 2:
        print("Usage: python config_manager.py <command>")
        print("Commands:")
        print("  list - List all available challenges")
        print("  get <challenge_id> - Get specific challenge config")
        print("  validate <challenge_id> - Validate challenge config")
        print("  info - Show config source information")
        sys.exit(1)

    try:
        config_manager = ConfigManager()
        command = sys.argv[1]

        if command == "list":
            challenges = config_manager.list_available_challenges()
            print(f"Available challenges ({len(challenges)}):")
            for challenge_id in sorted(challenges):
                try:
                    config = config_manager.get_challenge_config(challenge_id)
                    print(f"  {challenge_id}: {config['name']} ({config['category']})")
                except Exception as e:
                    print(f"  {challenge_id}: ERROR - {e}")

        elif command == "get" and len(sys.argv) > 2:
            challenge_id = sys.argv[2]
            config = config_manager.get_challenge_config(challenge_id)
            print(json.dumps(config, indent=2))

        elif command == "validate" and len(sys.argv) > 2:
            challenge_id = sys.argv[2]
            config = config_manager.get_challenge_config(challenge_id)
            is_valid = config_manager.validate_configuration(config)
            print(f"Configuration for {challenge_id}: {'VALID' if is_valid else 'INVALID'}")

        elif command == "info":
            info = config_manager.get_config_source_info()
            print("Configuration Source Information:")
            for key, value in info.items():
                print(f"  {key}: {value}")

        else:
            print("Unknown command or missing arguments")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)