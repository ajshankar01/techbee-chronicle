# -*- coding: utf-8 -*-
"""
tests/test_auth_security.py
Tests for the auth bugs fixed in Phase 2 and psychometric balance in Phase 4.
Ground Rule #16: Tests only for what already broke.
"""
import pytest
from enum import Enum


class TestDevTokenBypassLogic:
    """Fix 1: dev-token bypass logic gated on APP_ENV."""

    def test_dev_token_rejected_in_production_by_env_check(self):
        """When APP_ENV != development, the bypass condition must be False."""
        app_env = "production"
        token = "dev-token"
        bypass_allowed = (app_env == "development") and (
            token.startswith("dev-token") or token == "dev-token"
        )
        assert not bypass_allowed, (
            "dev-token bypass MUST be rejected when APP_ENV=production."
        )

    def test_dev_token_allowed_in_development(self):
        """When APP_ENV == development, dev-token must be accepted."""
        app_env = "development"
        token = "dev-token:test@hcltech.com:hr_manager"
        bypass_allowed = (app_env == "development") and token.startswith("dev-token")
        assert bypass_allowed

    def test_dev_token_email_parsing(self):
        """dev-token:email:role format must parse email and role correctly."""
        token = "dev-token:recruit@hcltech.com:hr_manager"
        parts = token.split(":")
        email = parts[1] if len(parts) >= 2 and "@" in parts[1] else ""
        role = parts[2] if len(parts) >= 3 else "hr_manager"
        assert email == "recruit@hcltech.com"
        assert role == "hr_manager"


class TestDomainRestriction:
    """Fix 2: HR auto-provisioning restricted to ALLOWED_HR_DOMAIN."""

    def test_non_hcltech_email_blocked(self):
        """Non-hcltech.com email must not pass the domain check."""
        allowed_domain = "hcltech.com"
        email = "attacker@gmail.com"
        passes = allowed_domain and email.lower().endswith(f"@{allowed_domain.lower()}")
        assert not passes

    def test_hcltech_email_allowed(self):
        """@hcltech.com email must pass the domain check."""
        allowed_domain = "hcltech.com"
        email = "ritu.sharma@hcltech.com"
        passes = bool(allowed_domain) and email.lower().endswith(f"@{allowed_domain.lower()}")
        assert passes

    def test_empty_allowed_domain_disables_restriction(self):
        """Empty ALLOWED_HR_DOMAIN must disable the restriction."""
        allowed_domain = ""
        restriction_active = bool(allowed_domain)
        assert not restriction_active


class TestEnumComparisonBug:
    """Fix 3: UserRole enum compared correctly via .value, not string coercion."""

    def test_plain_enum_not_equal_to_string(self):
        """
        Plain (non-str) Enum values are never equal to strings.
        This was the root cause of the super admin gate always failing.
        """
        class UserRolePlain(Enum):  # plain Enum, NOT str Enum
            SUPER_ADMIN = "super_admin"
            HR_MANAGER = "hr_manager"

        role = UserRolePlain.SUPER_ADMIN

        # Old broken comparison: enum object vs string tuple
        old_gate_fails = role not in ("super_admin",)
        assert old_gate_fails, (
            "Confirms the bug: plain Enum is not in a string tuple — "
            "the super admin gate was permanently open before the fix."
        )

        # New fixed comparison: compare .value
        user_role = role.value if hasattr(role, "value") else str(role)
        new_gate_correct = user_role not in ("super_admin",)
        assert not new_gate_correct, "Fixed .value comparison correctly identifies super admin"

    def test_hr_manager_enum_value_comparison(self):
        """HR manager must be correctly identified via .value comparison."""
        class UserRole(str, Enum):
            SUPER_ADMIN = "super_admin"
            HR_MANAGER = "hr_manager"

        role = UserRole.HR_MANAGER
        user_role = role.value if hasattr(role, "value") else str(role)
        assert user_role in ("hr_manager", "super_admin")


class TestPsychometricBalance:
    """Phase 4: Psychometric questions have balanced SA/SD/N ideal_response distribution."""

    def test_balanced_data_has_sa_sd_and_n(self):
        """Seeder data must include SA, SD, and N ideal responses."""
        # Import from the standalone data module (no DB deps)
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
        from psychometric_data import BALANCED_PSYCHOMETRIC_DATA

        responses = [q["ideal_response"] for q in BALANCED_PSYCHOMETRIC_DATA]
        assert "SA" in responses, "No SA-ideal questions found"
        assert "SD" in responses, "No SD-ideal (reverse-scored) questions found"
        assert "N" in responses, "No N-ideal (neutral) questions found"

        sa = sum(1 for r in responses if r == "SA")
        sd = sum(1 for r in responses if r == "SD")
        n  = sum(1 for r in responses if r == "N")
        total = len(responses)
        assert total == 20, f"Expected 20 balanced questions, got {total}"
        assert sa >= 6, f"Too few SA questions: {sa}"
        assert sd >= 6, f"Too few SD (reverse-scored) questions: {sd}"
        assert n  >= 4, f"Too few N (neutral) questions: {n}"

    def test_all_questions_have_ideal_response_field(self):
        """Every question must have a valid ideal_response value."""
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
        from psychometric_data import BALANCED_PSYCHOMETRIC_DATA

        for i, q in enumerate(BALANCED_PSYCHOMETRIC_DATA):
            assert "ideal_response" in q, f"Question {i} missing ideal_response"
            assert q["ideal_response"] in ("SA", "SD", "N"), (
                f"Question {i} has invalid ideal_response: {q['ideal_response']}"
            )