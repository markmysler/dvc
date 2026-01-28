"""
Comprehensive test suite for cryptographic flag system.

Tests flag generation, validation, and tamper resistance following TDD methodology.
These tests define the expected behavior before implementation.
"""

import pytest
import hmac
import hashlib
import time
from engine.flag_system import (
    FlagGenerator,
    FlagValidator,
    generate_unique_flag,
    validate_flag
)


class TestFlagGeneration:
    """Test flag generation functionality."""

    def test_generate_unique_flag_function_exists(self):
        """Test that the generate_unique_flag function is importable."""
        # This will fail initially - the function doesn't exist yet
        assert callable(generate_unique_flag)

    def test_flag_format(self):
        """Test that generated flags follow flag{16-hex} format."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        # Should be flag{16-char-hex}
        assert flag.startswith("flag{")
        assert flag.endswith("}")
        hex_part = flag[5:-1]  # Extract hex between flag{ and }
        assert len(hex_part) == 16
        # Should be valid hex
        int(hex_part, 16)  # Will raise ValueError if not valid hex

    def test_deterministic_generation(self):
        """Test that same inputs produce same flag."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag1 = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)
        flag2 = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        assert flag1 == flag2

    def test_different_user_different_flag(self):
        """Test that different user IDs produce different flags."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag1 = generate_unique_flag(challenge_id, "user1", instance_data, secret_key)
        flag2 = generate_unique_flag(challenge_id, "user2", instance_data, secret_key)

        assert flag1 != flag2

    def test_different_challenge_different_flag(self):
        """Test that different challenge IDs produce different flags."""
        secret_key = "test-secret-key-123"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag1 = generate_unique_flag("web-xss-basic", user_id, instance_data, secret_key)
        flag2 = generate_unique_flag("web-sqli-basic", user_id, instance_data, secret_key)

        assert flag1 != flag2

    def test_different_instance_data_different_flag(self):
        """Test that different instance data produces different flags."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"

        flag1 = generate_unique_flag(challenge_id, user_id, "timestamp:1769569066,nonce:abc123", secret_key)
        flag2 = generate_unique_flag(challenge_id, user_id, "timestamp:1769569070,nonce:def456", secret_key)

        assert flag1 != flag2

    def test_different_secret_key_different_flag(self):
        """Test that different secret keys produce different flags."""
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag1 = generate_unique_flag(challenge_id, user_id, instance_data, "secret1")
        flag2 = generate_unique_flag(challenge_id, user_id, instance_data, "secret2")

        assert flag1 != flag2


class TestFlagValidation:
    """Test flag validation functionality."""

    def test_validate_flag_function_exists(self):
        """Test that the validate_flag function is importable."""
        assert callable(validate_flag)

    def test_valid_flag_validation(self):
        """Test that valid flags validate successfully."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        is_valid = validate_flag(flag, challenge_id, user_id, instance_data, secret_key)
        assert is_valid is True

    def test_invalid_flag_validation(self):
        """Test that invalid flags fail validation."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        # Test completely invalid flag
        is_valid = validate_flag("flag{deadbeefcafebabe}", challenge_id, user_id, instance_data, secret_key)
        assert is_valid is False

    def test_tampered_flag_validation(self):
        """Test that tampered flags fail validation."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        # Tamper with the flag by changing one character
        tampered_flag = flag[:-2] + "99"  # Change last character

        is_valid = validate_flag(tampered_flag, challenge_id, user_id, instance_data, secret_key)
        assert is_valid is False

    def test_wrong_context_validation(self):
        """Test that flags fail validation with wrong context parameters."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        # Test with different user_id
        is_valid = validate_flag(flag, challenge_id, "different-user", instance_data, secret_key)
        assert is_valid is False

        # Test with different challenge_id
        is_valid = validate_flag(flag, "different-challenge", user_id, instance_data, secret_key)
        assert is_valid is False

        # Test with different instance_data
        is_valid = validate_flag(flag, challenge_id, user_id, "different-data", secret_key)
        assert is_valid is False

    def test_malformed_flag_format(self):
        """Test that malformed flags fail validation."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        # Test various malformed flags
        malformed_flags = [
            "notaflag{1234567890abcdef}",  # Wrong prefix
            "flag{123}",  # Too short
            "flag{1234567890abcdefg}",  # Too long
            "flag{1234567890abcdeg}",  # Invalid hex (g)
            "flag1234567890abcdef",  # Missing braces
            "{1234567890abcdef}",  # Missing flag prefix
            "flag{1234567890abcdef",  # Missing closing brace
            "",  # Empty string
        ]

        for malformed_flag in malformed_flags:
            is_valid = validate_flag(malformed_flag, challenge_id, user_id, instance_data, secret_key)
            assert is_valid is False, f"Malformed flag should be invalid: {malformed_flag}"


class TestFlagGeneratorClass:
    """Test the FlagGenerator class interface."""

    def test_flag_generator_class_exists(self):
        """Test that FlagGenerator class is importable."""
        assert FlagGenerator

    def test_flag_generator_initialization(self):
        """Test FlagGenerator can be initialized with secret key."""
        secret_key = "test-secret-key-123"
        generator = FlagGenerator(secret_key)
        assert generator.secret_key == secret_key

    def test_flag_generator_generate_method(self):
        """Test FlagGenerator.generate() method."""
        secret_key = "test-secret-key-123"
        generator = FlagGenerator(secret_key)

        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generator.generate(challenge_id, user_id, instance_data)

        # Should match functional API result
        expected_flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)
        assert flag == expected_flag


class TestFlagValidatorClass:
    """Test the FlagValidator class interface."""

    def test_flag_validator_class_exists(self):
        """Test that FlagValidator class is importable."""
        assert FlagValidator

    def test_flag_validator_initialization(self):
        """Test FlagValidator can be initialized with secret key."""
        secret_key = "test-secret-key-123"
        validator = FlagValidator(secret_key)
        assert validator.secret_key == secret_key

    def test_flag_validator_validate_method(self):
        """Test FlagValidator.validate() method."""
        secret_key = "test-secret-key-123"
        generator = FlagGenerator(secret_key)
        validator = FlagValidator(secret_key)

        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generator.generate(challenge_id, user_id, instance_data)
        is_valid = validator.validate(flag, challenge_id, user_id, instance_data)

        assert is_valid is True


class TestTamperResistance:
    """Test cryptographic tamper resistance."""

    def test_timing_attack_resistance(self):
        """Test that validation uses constant-time comparison."""
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        valid_flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)
        invalid_flag = "flag{deadbeefcafebabe}"

        # Time validation of valid flag
        start_time = time.time()
        for _ in range(1000):
            validate_flag(valid_flag, challenge_id, user_id, instance_data, secret_key)
        valid_time = time.time() - start_time

        # Time validation of invalid flag
        start_time = time.time()
        for _ in range(1000):
            validate_flag(invalid_flag, challenge_id, user_id, instance_data, secret_key)
        invalid_time = time.time() - start_time

        # Timing should be similar (within 50% difference)
        time_ratio = max(valid_time, invalid_time) / min(valid_time, invalid_time)
        assert time_ratio < 1.5, "Timing attack vulnerability detected"

    def test_hmac_usage(self):
        """Test that implementation uses HMAC for cryptographic security."""
        # This test will verify the implementation uses HMAC properly
        # by checking that the output changes predictably with input changes
        secret_key = "test-secret-key-123"
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        flag = generate_unique_flag(challenge_id, user_id, instance_data, secret_key)

        # Manually compute expected HMAC result
        combined_input = f"{challenge_id}:{user_id}:{instance_data}"
        expected_hash = hmac.new(
            secret_key.encode('utf-8'),
            combined_input.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()[:16]  # First 16 chars
        expected_flag = f"flag{{{expected_hash}}}"

        assert flag == expected_flag

    def test_secret_key_isolation(self):
        """Test that secret key cannot be derived from flags."""
        challenge_id = "web-xss-basic"
        user_id = "test-user"
        instance_data = "timestamp:1769569066,nonce:abc123"

        # Generate flags with different secret keys
        flags = []
        for i in range(10):
            secret = f"secret-{i}"
            flag = generate_unique_flag(challenge_id, user_id, instance_data, secret)
            flags.append(flag)

        # Flags should all be different
        assert len(set(flags)) == 10, "All flags with different secrets should be unique"

        # No flag should contain any part of any secret key
        for flag in flags:
            for i in range(10):
                secret = f"secret-{i}"
                assert secret not in flag, f"Secret key should not be visible in flag: {flag}"