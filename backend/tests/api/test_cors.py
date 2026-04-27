"""
Regression tests for CORS preflight handling.

Background — bug shipped on 2026-04-27:
    The admin dashboard (https://www.endura.eco/dashboard-e9x2k/) calls
    PATCH /admin/feedback/{id} with custom headers (X-Admin-Key,
    Content-Type). Browsers preflight any non-simple request with an
    OPTIONS call. Our CORSMiddleware was configured with
    `allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]` —
    PATCH was missing, so every preflight failed and admins saw
    "Save failed: Failed to fetch" with no usable signal.

    The existing API test (`test_feedback_status_update`) used
    `client.patch(...)` which goes through the in-process TestClient and
    *does not* exercise CORS, so the regression slipped through.

These tests replay the exact preflight a browser would send and assert
that the server greenlights it. Add a new check here for any future
custom verb / header the admin dashboard or mobile app starts using.
"""
from __future__ import annotations

import pytest


ADMIN_ORIGIN = "https://www.endura.eco"


def _preflight(client, *, method: str, path: str, request_headers: str = "x-admin-key, content-type"):
    """Issue the OPTIONS request a browser would send before `method path`."""
    return client.options(
        path,
        headers={
            "Origin": ADMIN_ORIGIN,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": request_headers,
        },
    )


class TestAdminPatchPreflight:
    """The exact preflight that was failing in production on 2026-04-27."""

    def test_patch_admin_feedback_preflight_is_allowed(self, client):
        resp = _preflight(client, method="PATCH", path="/admin/feedback/1")
        assert resp.status_code == 200, (
            f"CORS preflight for PATCH /admin/feedback was rejected "
            f"(status={resp.status_code}). The dashboard will surface "
            f"'Failed to fetch' with no useful signal. Make sure 'PATCH' "
            f"is in CORSMiddleware allow_methods."
        )

        allow_methods = resp.headers.get("access-control-allow-methods", "")
        assert "PATCH" in allow_methods.upper(), (
            f"Preflight succeeded but PATCH not advertised in "
            f"Access-Control-Allow-Methods (got: {allow_methods!r})."
        )

        allow_headers = resp.headers.get("access-control-allow-headers", "")
        assert "x-admin-key" in allow_headers.lower(), (
            f"X-Admin-Key not advertised in Access-Control-Allow-Headers "
            f"(got: {allow_headers!r}). Admin dashboard requests will be "
            f"blocked by the browser."
        )

        allow_origin = resp.headers.get("access-control-allow-origin", "")
        assert allow_origin == ADMIN_ORIGIN, (
            f"Origin {ADMIN_ORIGIN!r} not echoed back as allowed "
            f"(got: {allow_origin!r}). Admin dashboard hosted there will be "
            f"blocked."
        )


class TestAdminVerbsPreflight:
    """Sanity-check every HTTP verb our admin dashboard relies on."""

    @pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
    def test_method_preflight_allowed_from_admin_origin(self, client, method):
        resp = _preflight(client, method=method, path="/admin/feedback/1")
        assert resp.status_code == 200, (
            f"Preflight for {method} from {ADMIN_ORIGIN} was rejected "
            f"(status={resp.status_code}). If the dashboard ever issues "
            f"a {method}, it will fail with 'Failed to fetch'."
        )
        assert method in resp.headers.get("access-control-allow-methods", "").upper()


class TestAdminFeedbackReplyPreflight:
    """Admin dashboard POST /admin/feedback/{id}/reply uses JSON + X-Admin-Key."""

    def test_post_admin_feedback_reply_preflight(self, client):
        resp = _preflight(client, method="POST", path="/admin/feedback/1/reply")
        assert resp.status_code == 200
        assert "POST" in resp.headers.get("access-control-allow-methods", "").upper()
