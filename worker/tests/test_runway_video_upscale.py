import unittest

from providers import runway_video_upscale as provider
from providers.http_helpers import ProviderError


class RunwayVideoUpscaleTests(unittest.TestCase):
  def test_provider_uses_documented_model_and_version(self):
    import os
    old = os.environ.get("RUNWAYML_API_SECRET")
    os.environ["RUNWAYML_API_SECRET"] = "test-secret"
    try:
      headers = provider._headers()
      self.assertEqual(headers["X-Runway-Version"], "2024-11-06")
      self.assertEqual(headers["Authorization"], "Bearer test-secret")
      self.assertEqual(provider.MODEL, "magnific_video_upscaler_creative")
    finally:
      if old is None: os.environ.pop("RUNWAYML_API_SECRET", None)
      else: os.environ["RUNWAYML_API_SECRET"] = old


  def test_provider_requires_server_credential(self):
    import os
    keys = {key: os.environ.pop(key, None) for key in ("RUNWAYML_API_SECRET", "RUNWAY_API_KEY")}
    try:
      with self.assertRaisesRegex(ProviderError, "not configured"):
        provider._headers()
    finally:
      for key, value in keys.items():
        if value is not None: os.environ[key] = value


  def test_provider_sanitizes_http_error(self):
    class Response:
      is_error = True
      status_code = 429

    with self.assertRaisesRegex(ProviderError, r"Runway request failed \(429\)"):
      provider._check(Response())
