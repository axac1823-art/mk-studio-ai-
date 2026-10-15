"""Regression tests for accurate provider-error messages in Image2 Auto mode."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from workflows.common import _client_failure_message
from workflows.engine import AllModelsFailedError


def _failed_attempts(*errors: str) -> AllModelsFailedError:
    return AllModelsFailedError(
        "text_to_image",
        [{"candidateKey": f"model-{index}", "ok": False, "error": error} for index, error in enumerate(errors)],
    )


def test_mixed_provider_failures_are_not_reported_as_global_quota_exhaustion():
    err = _failed_attempts(
        "OpenAI failed (402): insufficient_quota",
        "Google failed (422): unsupported parameter image_size",
        "BFL failed (400): invalid request body",
    )

    message = _client_failure_message(err)

    assert "different reasons" in message
    assert "does not mean all providers are out of quota" in message
    assert message != "The AI provider has reached its quota or billing limit. Check its usage and billing, or try another available model."


def test_quota_message_is_used_when_every_attempt_reports_quota():
    err = _failed_attempts(
        "OpenAI failed: insufficient_quota",
        "Google failed: quota exceeded",
    )

    assert _client_failure_message(err) == (
        "The AI provider has reached its quota or billing limit. Check its usage and billing, or try another available model."
    )


def test_selected_single_model_quota_failure_keeps_specific_message():
    err = _failed_attempts("OpenAI failed: credit_balance_exhausted")

    assert _client_failure_message(err) == (
        "The AI provider has reached its quota or billing limit. Check its usage and billing, or try another available model."
    )
