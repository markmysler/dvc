#!/usr/bin/env python3
"""
Configuration Migration Script

Migrate individual config.json files to unified challenges.json configuration.
Consolidates challenge configurations into single source of truth.
"""

import json
import os
import argparse
import shutil
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Try to import colorama for colored output
try:
    from colorama import init, Fore, Back, Style
    init()
    HAS_COLOR = True
except ImportError:
    # Fallback to no color if colorama not available
    HAS_COLOR = False
    class ForeColor:
        RED = GREEN = YELLOW = BLUE = MAGENTA = CYAN = WHITE = RESET = ''
    class StyleColor:
        BRIGHT = DIM = RESET_ALL = ''
    Fore = ForeColor()
    Style = StyleColor()


class MigrationError(Exception):
    """Exception for migration-related errors"""
    pass


class ConfigMigrator:
    """
    Configuration migration manager for consolidating individual challenge configs
    """

    def __init__(self,
                 challenges_base: str = "challenges",
                 unified_config: str = "challenges/definitions/challenges.json",
                 verbose: bool = False):
        """
        Initialize configuration migrator

        Args:
            challenges_base: Base directory containing challenge directories
            unified_config: Path to unified configuration file
            verbose: Enable verbose output
        """
        self.challenges_base = Path(challenges_base)
        self.unified_config = Path(unified_config)
        self.verbose = verbose

        # Migration tracking
        self.processed_configs: List[Dict] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def _print(self, message: str, color: str = '', end: str = '\n') -> None:
        """Print with optional color"""
        if HAS_COLOR and color:
            print(f"{color}{message}{Style.RESET_ALL}", end=end)
        else:
            print(message, end=end)

    def _print_verbose(self, message: str) -> None:
        """Print verbose message if verbose mode enabled"""
        if self.verbose:
            self._print(f"  → {message}", Fore.CYAN)

    def _print_error(self, message: str) -> None:
        """Print error message"""
        self._print(f"ERROR: {message}", Fore.RED)
        self.errors.append(message)

    def _print_warning(self, message: str) -> None:
        """Print warning message"""
        self._print(f"WARNING: {message}", Fore.YELLOW)
        self.warnings.append(message)

    def _print_success(self, message: str) -> None:
        """Print success message"""
        self._print(f"✓ {message}", Fore.GREEN)

    def scan_individual_configs(self) -> List[Path]:
        """
        Scan for individual config.json files in challenge directories

        Returns:
            List of paths to individual config files
        """
        config_files = []

        if not self.challenges_base.exists():
            self._print_warning(f"Challenges base directory not found: {self.challenges_base}")
            return config_files

        self._print_verbose(f"Scanning {self.challenges_base} for individual config files...")

        for item in self.challenges_base.iterdir():
            if not item.is_dir():
                continue

            # Skip definitions directory (contains unified config)
            if item.name == 'definitions':
                continue

            config_file = item / 'config.json'
            if config_file.exists():
                config_files.append(config_file)
                self._print_verbose(f"Found config: {config_file}")

        self._print(f"Found {len(config_files)} individual configuration files")
        return config_files

    def validate_config(self, config: Dict[str, Any], config_path: Path) -> bool:
        """
        Validate individual challenge configuration

        Args:
            config: Configuration dictionary to validate
            config_path: Path to the config file for error reporting

        Returns:
            True if valid, False otherwise
        """
        try:
            # Required top-level fields
            required_fields = ['id', 'name', 'description', 'difficulty', 'category', 'container_spec']
            for field in required_fields:
                if field not in config:
                    self._print_error(f"Missing required field '{field}' in {config_path}")
                    return False

            # Validate container_spec
            container_spec = config.get('container_spec', {})
            if 'image' not in container_spec:
                self._print_error(f"Missing 'image' in container_spec for {config_path}")
                return False

            # Check for valid difficulty
            valid_difficulties = ['beginner', 'intermediate', 'advanced', 'expert']
            if config['difficulty'] not in valid_difficulties:
                self._print_warning(f"Non-standard difficulty '{config['difficulty']}' in {config_path}")

            # Check for valid category
            common_categories = ['web', 'crypto', 'pwn', 'reverse', 'misc', 'forensics']
            if config['category'] not in common_categories:
                self._print_verbose(f"Custom category '{config['category']}' in {config_path}")

            return True

        except Exception as e:
            self._print_error(f"Validation error for {config_path}: {e}")
            return False

    def load_config_file(self, config_path: Path) -> Optional[Dict[str, Any]]:
        """
        Load and validate a single configuration file

        Args:
            config_path: Path to configuration file

        Returns:
            Configuration dictionary if successful, None if failed
        """
        try:
            self._print_verbose(f"Loading {config_path}")

            with open(config_path, 'r') as f:
                config = json.load(f)

            # Validate configuration
            if not self.validate_config(config, config_path):
                return None

            # Add migration metadata
            if 'metadata' not in config:
                config['metadata'] = {}

            config['metadata']['migration'] = {
                'migrated_from': str(config_path),
                'migrated_at': datetime.now().isoformat(),
                'migration_tool': 'migrate-configs.py'
            }

            return config

        except json.JSONDecodeError as e:
            self._print_error(f"Invalid JSON in {config_path}: {e}")
            return None
        except Exception as e:
            self._print_error(f"Failed to load {config_path}: {e}")
            return None

    def load_existing_unified_config(self) -> Dict[str, Any]:
        """
        Load existing unified configuration

        Returns:
            Existing unified configuration or new structure
        """
        if not self.unified_config.exists():
            self._print_verbose("No existing unified config found, creating new structure")
            return {
                "schema_version": "1.0",
                "challenges": []
            }

        try:
            self._print_verbose(f"Loading existing unified config from {self.unified_config}")

            with open(self.unified_config, 'r') as f:
                unified_config = json.load(f)

            # Ensure proper structure
            if 'challenges' not in unified_config:
                unified_config['challenges'] = []
            if 'schema_version' not in unified_config:
                unified_config['schema_version'] = '1.0'

            self._print_verbose(f"Existing config has {len(unified_config['challenges'])} challenges")
            return unified_config

        except Exception as e:
            self._print_error(f"Failed to load existing unified config: {e}")
            raise MigrationError(f"Cannot load existing config: {e}")

    def backup_file(self, file_path: Path, suffix: str = None) -> Path:
        """
        Create backup of file

        Args:
            file_path: Path to file to backup
            suffix: Optional suffix for backup filename

        Returns:
            Path to backup file
        """
        if suffix is None:
            suffix = datetime.now().strftime("%Y%m%d_%H%M%S")

        backup_path = file_path.with_suffix(f'.{suffix}.backup')
        shutil.copy2(file_path, backup_path)
        self._print_verbose(f"Created backup: {backup_path}")
        return backup_path

    def migrate_configurations(self, dry_run: bool = False, backup: bool = True) -> Dict[str, Any]:
        """
        Migrate individual configurations to unified format

        Args:
            dry_run: If True, show what would be done without making changes
            backup: If True, create backups before modification

        Returns:
            Migration report dictionary
        """
        try:
            # Scan for individual configs
            individual_configs = self.scan_individual_configs()

            if not individual_configs:
                self._print("No individual configuration files found to migrate")
                return {
                    'status': 'success',
                    'processed': 0,
                    'added': 0,
                    'skipped': 0,
                    'errors': 0
                }

            # Load existing unified config
            unified_config = self.load_existing_unified_config()
            existing_ids = {challenge['id'] for challenge in unified_config['challenges']}

            # Process each individual config
            added_configs = []
            skipped_configs = []

            for config_path in individual_configs:
                config = self.load_config_file(config_path)
                if not config:
                    continue  # Error already logged

                challenge_id = config['id']

                # Check for duplicates
                if challenge_id in existing_ids:
                    self._print_warning(f"Challenge '{challenge_id}' already exists in unified config, skipping")
                    skipped_configs.append(challenge_id)
                    continue

                # Add to migration list
                added_configs.append(config)
                existing_ids.add(challenge_id)
                self._print_success(f"Will migrate '{challenge_id}' from {config_path}")

            # Show migration summary
            self._print(f"\nMigration Summary:")
            self._print(f"  Individual configs found: {len(individual_configs)}")
            self._print(f"  Configs to add: {len(added_configs)}")
            self._print(f"  Configs skipped (duplicates): {len(skipped_configs)}")
            self._print(f"  Existing challenges in unified config: {len(existing_ids) - len(added_configs)}")

            if dry_run:
                self._print(f"\n{Fore.YELLOW}DRY RUN MODE - No changes made{Style.RESET_ALL}")
                return {
                    'status': 'dry_run',
                    'processed': len(individual_configs),
                    'added': len(added_configs),
                    'skipped': len(skipped_configs),
                    'errors': len(self.errors)
                }

            if not added_configs:
                self._print("No new configurations to migrate")
                return {
                    'status': 'success',
                    'processed': len(individual_configs),
                    'added': 0,
                    'skipped': len(skipped_configs),
                    'errors': len(self.errors)
                }

            # Create backup if requested and file exists
            if backup and self.unified_config.exists():
                backup_path = self.backup_file(self.unified_config)
                self._print_success(f"Backup created: {backup_path}")

            # Add new configurations
            unified_config['challenges'].extend(added_configs)

            # Ensure output directory exists
            self.unified_config.parent.mkdir(parents=True, exist_ok=True)

            # Write updated unified config
            with open(self.unified_config, 'w') as f:
                json.dump(unified_config, f, indent=2, sort_keys=True)

            self._print_success(f"Migration complete! Updated {self.unified_config}")
            self._print(f"Total challenges in unified config: {len(unified_config['challenges'])}")

            return {
                'status': 'success',
                'processed': len(individual_configs),
                'added': len(added_configs),
                'skipped': len(skipped_configs),
                'errors': len(self.errors),
                'unified_config_path': str(self.unified_config),
                'total_challenges': len(unified_config['challenges'])
            }

        except Exception as e:
            self._print_error(f"Migration failed: {e}")
            raise MigrationError(f"Migration process failed: {e}")

    def generate_report(self, migration_result: Dict[str, Any]) -> None:
        """Generate detailed migration report"""
        self._print(f"\n{'='*60}")
        self._print(f"MIGRATION REPORT")
        self._print(f"{'='*60}")
        self._print(f"Status: {migration_result['status'].upper()}")
        self._print(f"Timestamp: {datetime.now().isoformat()}")
        self._print(f"")
        self._print(f"Files processed: {migration_result['processed']}")
        self._print(f"Configurations added: {migration_result['added']}")
        self._print(f"Configurations skipped: {migration_result['skipped']}")
        self._print(f"Errors encountered: {migration_result['errors']}")

        if 'unified_config_path' in migration_result:
            self._print(f"Unified config path: {migration_result['unified_config_path']}")
            self._print(f"Total challenges: {migration_result['total_challenges']}")

        if self.warnings:
            self._print(f"\nWarnings ({len(self.warnings)}):")
            for warning in self.warnings:
                self._print(f"  • {warning}")

        if self.errors:
            self._print(f"\nErrors ({len(self.errors)}):")
            for error in self.errors:
                self._print(f"  • {error}")

        if migration_result['status'] == 'success' and migration_result['added'] > 0:
            self._print(f"\n{Fore.GREEN}✓ Migration completed successfully!{Style.RESET_ALL}")
        elif migration_result['status'] == 'dry_run':
            self._print(f"\n{Fore.BLUE}ℹ Dry run completed - no changes made{Style.RESET_ALL}")
        elif migration_result['added'] == 0:
            self._print(f"\n{Fore.YELLOW}ℹ No new configurations to migrate{Style.RESET_ALL}")


def main():
    """CLI entry point for migration script"""
    parser = argparse.ArgumentParser(
        description="Migrate individual config.json files to unified challenges.json",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                          # Run migration with default settings
  %(prog)s --dry-run                # Show what would be migrated without changes
  %(prog)s --verbose                # Enable detailed output
  %(prog)s --backup --verbose       # Create backup and show detailed output
  %(prog)s --challenges-base ./alt  # Use alternative challenges directory
        """
    )

    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be migrated without making changes')
    parser.add_argument('--backup', action='store_true', default=True,
                        help='Create backup of existing unified config (default: True)')
    parser.add_argument('--no-backup', dest='backup', action='store_false',
                        help='Skip creating backup of existing unified config')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Enable verbose output')
    parser.add_argument('--challenges-base', default='challenges',
                        help='Base directory containing challenge directories (default: challenges)')
    parser.add_argument('--unified-config', default='challenges/definitions/challenges.json',
                        help='Path to unified configuration file (default: challenges/definitions/challenges.json)')

    args = parser.parse_args()

    # Create migrator instance
    migrator = ConfigMigrator(
        challenges_base=args.challenges_base,
        unified_config=args.unified_config,
        verbose=args.verbose
    )

    try:
        # Run migration
        result = migrator.migrate_configurations(
            dry_run=args.dry_run,
            backup=args.backup
        )

        # Generate report
        migrator.generate_report(result)

        # Exit with appropriate code
        if result['errors'] > 0:
            sys.exit(1)
        else:
            sys.exit(0)

    except KeyboardInterrupt:
        migrator._print(f"\n{Fore.YELLOW}Migration cancelled by user{Style.RESET_ALL}")
        sys.exit(130)
    except MigrationError as e:
        migrator._print_error(str(e))
        sys.exit(1)
    except Exception as e:
        migrator._print_error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()