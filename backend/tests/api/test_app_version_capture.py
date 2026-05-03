"""Tests for the X-App-Version / X-App-Build header capture path.

Background: app_version was previously only captured during push registration,
so users who declined push permission stayed on NULL forever. The new capture
hook in `auth.get_current_user` reads the headers on every authenticated
request and opportunistically updates the user row.

These tests cover the four cases that matter:
  1. Headers present → user row populated
  2. Same headers re-sent → no second write (no `app_version_updated_at` bump)
  3. Headers change (user upgraded their app) → row updated and timestamp bumped
  4. Headers absent → no write, no error
"""

import pytest
from tests.conftest import jwt_headers


@pytest.fixture(autouse=True)
def _no_email(mock_resend):
    pass


def _me(client, headers, extra=None):
    h = dict(headers)
    if extra:
        h.update(extra)
    return client.get("/auth/me", headers=h)


def test_app_version_headers_persisted_on_first_call(client, alice, db):
    """First authenticated call with X-App-Version / X-App-Build should land
    both values plus an `app_version_updated_at` timestamp on the user row."""
    assert alice.app_version is None
    assert alice.app_build is None
    assert alice.app_version_updated_at is None

    resp = _me(client, jwt_headers(alice.email), {
        "X-App-Version": "1.0.5",
        "X-App-Build": "28",
    })
    assert resp.status_code == 200

    db.refresh(alice)
    assert alice.app_version == "1.0.5"
    assert alice.app_build == "28"
    assert alice.app_version_updated_at is not None


def test_no_write_when_headers_unchanged(client, alice, db):
    """Repeating the same headers must not bump app_version_updated_at — the
    hook is supposed to short-circuit when nothing changed (hot-row safety)."""
    _me(client, jwt_headers(alice.email), {
        "X-App-Version": "1.0.5",
        "X-App-Build": "28",
    })
    db.refresh(alice)
    first_ts = alice.app_version_updated_at
    assert first_ts is not None

    _me(client, jwt_headers(alice.email), {
        "X-App-Version": "1.0.5",
        "X-App-Build": "28",
    })
    db.refresh(alice)
    assert alice.app_version_updated_at == first_ts, (
        "Second call with identical headers should NOT update the timestamp"
    )


def test_version_bump_updates_row_and_timestamp(client, alice, db):
    """When the user upgrades the app and starts sending a new version, the
    row should reflect it and the `app_version_updated_at` timestamp should
    advance — that's what the admin "outdated cohort" UI keys off."""
    _me(client, jwt_headers(alice.email), {
        "X-App-Version": "1.0.4",
        "X-App-Build": "27",
    })
    db.refresh(alice)
    old_ts = alice.app_version_updated_at
    assert alice.app_version == "1.0.4"

    # Simulate the user updating to the new build
    _me(client, jwt_headers(alice.email), {
        "X-App-Version": "1.0.5",
        "X-App-Build": "28",
    })
    db.refresh(alice)
    assert alice.app_version == "1.0.5"
    assert alice.app_build == "28"
    assert alice.app_version_updated_at >= old_ts


def test_missing_headers_does_not_break_request(client, alice, db):
    """A web/admin/old-build call with no version headers must not error and
    must not touch the existing values."""
    alice.app_version = "0.9.0"
    alice.app_build = "1"
    db.commit()

    resp = _me(client, jwt_headers(alice.email))
    assert resp.status_code == 200

    db.refresh(alice)
    assert alice.app_version == "0.9.0"
    assert alice.app_build == "1"


def test_header_value_truncated_to_20_chars(client, alice, db):
    """Defensive: app_version column is VARCHAR(20). A malicious or buggy
    client sending a 100-char string should be silently truncated, not 500."""
    long_version = "1.0.5" + ("x" * 100)
    resp = _me(client, jwt_headers(alice.email), {
        "X-App-Version": long_version,
    })
    assert resp.status_code == 200

    db.refresh(alice)
    assert alice.app_version is not None
    assert len(alice.app_version) <= 20
