"""Tests for GET /public/client-config (store update gate env wiring)."""

from __future__ import annotations


class TestPublicClientConfig:
    def test_defaults_no_minimums(self, client, monkeypatch):
        for key in (
            "MOBILE_MIN_IOS_VERSION",
            "MOBILE_MIN_IOS_BUILD",
            "MOBILE_MIN_ANDROID_VERSION",
            "MOBILE_MIN_ANDROID_VERSION_CODE",
            "MOBILE_UPDATE_MESSAGE",
            "MOBILE_IOS_STORE_URL",
            "MOBILE_ANDROID_STORE_URL",
            "MOBILE_IOS_APP_STORE_ID",
        ):
            monkeypatch.delenv(key, raising=False)
        r = client.get("/public/client-config")
        assert r.status_code == 200
        body = r.json()
        assert body["ios"]["min_version"] is None
        assert body["ios"]["min_build"] is None
        assert body["android"]["min_version"] is None
        assert body["android"]["min_version_code"] is None
        assert "apps.apple.com" in body["ios_store_url"]
        assert "com.endura.study" in body["android_store_url"]

    def test_ios_minimums_from_env(self, monkeypatch, client):
        monkeypatch.setenv("MOBILE_MIN_IOS_VERSION", "9.9.9")
        monkeypatch.setenv("MOBILE_MIN_IOS_BUILD", "999")
        monkeypatch.setenv("MOBILE_UPDATE_MESSAGE", "Please update.")
        monkeypatch.setenv("MOBILE_IOS_STORE_URL", "https://example.com/ios")
        r = client.get("/public/client-config")
        assert r.status_code == 200
        body = r.json()
        assert body["ios"]["min_version"] == "9.9.9"
        assert body["ios"]["min_build"] == 999
        assert body["update_message"] == "Please update."
        assert body["ios_store_url"] == "https://example.com/ios"

    def test_android_minimums_from_env(self, monkeypatch, client):
        monkeypatch.setenv("MOBILE_MIN_ANDROID_VERSION", "2.1.0")
        monkeypatch.setenv("MOBILE_MIN_ANDROID_VERSION_CODE", "42")
        r = client.get("/public/client-config")
        body = r.json()
        assert body["android"]["min_version"] == "2.1.0"
        assert body["android"]["min_version_code"] == 42
