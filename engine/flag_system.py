"""
Cryptographic flag generation and validation system.

Provides secure, unique flag generation per challenge instance using HMAC-SHA256
with tamper-proof validation and timing attack resistance.

Core functionality:
- generate_unique_flag: Creates unique flags per challenge/user/instance
- validate_flag: Validates flags cryptographically with constant-time comparison
- FlagGenerator/FlagValidator: Class-based APIs for integration

Security features:
- HMAC-SHA256 for cryptographic security
- Unique flags per user/challenge/instance combination
- Tamper-proof validation
- Timing attack resistance via hmac.compare_digest
- CTF-standard flag format: flag{16-hex-chars}
"""

import hmac
import hashlib
import re
from typing import Optional


class FlagGenerator:
    """
    Cryptographically secure flag generator.

    Uses HMAC-SHA256 with secret key to generate unique, tamper-proof flags
    per challenge instance.
    """

    def __init__(self, secret_key: str):
        """
        Initialize flag generator with secret key.

        Args:
            secret_key: Secret key for HMAC generation
        """
        self.secret_key = secret_key

    def generate(self, challenge_id: str, user_id: str, instance_data: str) -> str:
        """
        Generate unique flag for challenge instance.

        Args:
            challenge_id: Unique challenge identifier
            user_id: User identifier
            instance_data: Instance-specific data (timestamp, nonce, etc.)

        Returns:
            Flag in format flag{16-hex-chars}
        """
        return generate_unique_flag(challenge_id, user_id, instance_data, self.secret_key)


class FlagValidator:
    """
    Cryptographically secure flag validator.

    Uses constant-time comparison to validate flags and prevent timing attacks.
    """

    def __init__(self, secret_key: str):
        """
        Initialize flag validator with secret key.

        Args:
            secret_key: Secret key for HMAC validation
        """
        self.secret_key = secret_key

    def validate(self, flag: str, challenge_id: str, user_id: str, instance_data: str) -> bool:
        """
        Validate flag for challenge instance.

        Args:
            flag: Submitted flag to validate
            challenge_id: Challenge identifier
            user_id: User identifier
            instance_data: Instance-specific data

        Returns:
            True if flag is valid, False otherwise
        """
        return validate_flag(flag, challenge_id, user_id, instance_data, self.secret_key)


def generate_unique_flag(challenge_id: str, user_id: str, instance_data: str, secret_key: str) -> str:
    """
    Generate cryptographically unique flag for challenge instance.

    Creates deterministic but unguessable flags using HMAC-SHA256 with secret key.
    Same inputs always produce same flag; different inputs produce different flags.

    Args:
        challenge_id: Unique identifier for the challenge
        user_id: Unique identifier for the user
        instance_data: Instance-specific data (timestamp, nonce, etc.)
        secret_key: Secret key for HMAC generation

    Returns:
        Flag in CTF format: flag{16-character-hex}

    Example:
        >>> flag = generate_unique_flag("web-xss-basic", "user123", "ts:1234,nonce:abc", "secret")
        >>> print(flag)
        flag{a1b2c3d4e5f67890}
    """
    # Combine all input parameters with colons as separator
    combined_input = f"{challenge_id}:{user_id}:{instance_data}"

    # Generate HMAC-SHA256 hash using secret key
    mac = hmac.new(
        secret_key.encode('utf-8'),
        combined_input.encode('utf-8'),
        hashlib.sha256
    )

    # Take first 16 characters of hex digest for readability
    hex_hash = mac.hexdigest()[:16]

    # Format as CTF flag
    return f"flag{{{hex_hash}}}"


def validate_flag(flag: str, challenge_id: str, user_id: str, instance_data: str, secret_key: str) -> bool:
    """
    Validate submitted flag cryptographically.

    Uses constant-time comparison to prevent timing attacks. Validates both
    flag format and cryptographic authenticity.

    Args:
        flag: Submitted flag to validate
        challenge_id: Challenge identifier used in generation
        user_id: User identifier used in generation
        instance_data: Instance data used in generation
        secret_key: Secret key used in generation

    Returns:
        True if flag is valid and authentic, False otherwise

    Example:
        >>> is_valid = validate_flag("flag{a1b2c3d4e5f67890}", "web-xss-basic", "user123", "ts:1234", "secret")
        >>> print(is_valid)
        True
    """
    # Validate flag format: flag{16-hex-chars}
    if not _is_valid_flag_format(flag):
        return False

    # Generate expected flag with same parameters
    expected_flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(flag.encode('utf-8'), expected_flag.encode('utf-8'))


def _is_valid_flag_format(flag: str) -> bool:
    """
    Validate flag format without cryptographic check.

    Checks that flag matches pattern: flag{16-hex-characters}

    Args:
        flag: Flag string to validate

    Returns:
        True if format is valid, False otherwise
    """
    if not isinstance(flag, str):
        return False

    # Check exact format: flag{16-hex-chars}
    pattern = r'^flag\{[0-9a-f]{16}\}$'
    return bool(re.match(pattern, flag))