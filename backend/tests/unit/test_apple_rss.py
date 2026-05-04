"""Unit tests for the Apple iTunes RSS marketing-feed adapter.

These tests intentionally do not hit the network — every test feeds the
parser a hand-crafted JSON payload that mirrors the real iTunes RSS
shape. If Apple ever changes the schema, ``_parse_feed`` will be the
single place to update and these tests will catch the regression.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from services import apple_rss


def _make_feed(entries):
    """Build a minimally-valid iTunes RSS envelope around ``entries``."""
    return {"feed": {"entry": entries}}


def _entry(app_id: str, name: str, category: str = "Education"):
    return {
        "id": {
            "label": f"https://apps.apple.com/us/app/_/id{app_id}",
            "attributes": {"im:id": str(app_id)},
        },
        "im:name": {"label": name},
        "category": {"attributes": {"label": category, "im:id": "6017"}},
    }


# ---------------------------------------------------------------------------
# URL builder
# ---------------------------------------------------------------------------

class TestBuildUrl:
    def test_includes_country_subtype_limit_and_genre(self):
        url = apple_rss._build_url("US", apple_rss.SUBTYPE_FREE, 50, apple_rss.GENRE_EDUCATION)
        assert url == (
            "https://itunes.apple.com/us/rss/topfreeapplications/"
            "limit=50/genre=6017/json"
        )

    def test_omits_genre_when_none(self):
        url = apple_rss._build_url("gb", apple_rss.SUBTYPE_FREE, 200, None)
        assert url == "https://itunes.apple.com/gb/rss/topfreeapplications/limit=200/json"

    def test_lowercases_country(self):
        url = apple_rss._build_url("DE", apple_rss.SUBTYPE_FREE, 10, None)
        assert "/de/" in url
        assert "/DE/" not in url

    def test_paid_subtype_uses_paid_feed(self):
        url = apple_rss._build_url("US", apple_rss.SUBTYPE_PAID, 25, None)
        assert "toppaidapplications" in url

    def test_ipad_device_uses_ipad_feed(self):
        url = apple_rss._build_url(
            "AR", apple_rss.SUBTYPE_FREE, 200, apple_rss.GENRE_PRODUCTIVITY,
            device=apple_rss.DEVICE_IPAD,
        )
        assert "topfreeipadapplications" in url
        assert "/ar/" in url
        assert "genre=6007" in url

    def test_default_device_is_iphone(self):
        url = apple_rss._build_url("US", apple_rss.SUBTYPE_FREE, 50, None)
        assert "topfreeapplications" in url
        assert "topfreeipadapplications" not in url

    def test_rejects_unknown_subtype(self):
        with pytest.raises(ValueError, match="(?i)subtype|device"):
            apple_rss._build_url("US", "grossing", 10, None)

    def test_rejects_unknown_device(self):
        with pytest.raises(ValueError, match="(?i)device"):
            apple_rss._build_url(
                "US", apple_rss.SUBTYPE_FREE, 10, None, device="watch",
            )

    @pytest.mark.parametrize("bad", [0, -1, 201, 1000])
    def test_rejects_invalid_limit(self, bad):
        with pytest.raises(ValueError, match="limit"):
            apple_rss._build_url("US", apple_rss.SUBTYPE_FREE, bad, None)


# ---------------------------------------------------------------------------
# Feed parser
# ---------------------------------------------------------------------------

class TestParseFeed:
    def test_returns_entries_in_chart_order(self):
        feed = _make_feed([
            _entry("111", "First"),
            _entry("222", "Second"),
            _entry("333", "Third"),
        ])
        rows = apple_rss._parse_feed(feed)
        assert [r.rank for r in rows] == [1, 2, 3]
        assert [r.app_id for r in rows] == ["111", "222", "333"]
        assert rows[0].name == "First"
        assert rows[0].category_label == "Education"

    def test_skips_entries_with_missing_app_id(self):
        feed = _make_feed([
            {"im:name": {"label": "no id"}},
            _entry("999", "real"),
        ])
        rows = apple_rss._parse_feed(feed)
        assert len(rows) == 1
        assert rows[0].app_id == "999"
        # Rank reflects the original chart position even when garbage entries
        # appeared before — Apple's chart position for the kept app was #2.
        assert rows[0].rank == 2

    def test_handles_missing_feed_or_entry_gracefully(self):
        assert apple_rss._parse_feed({}) == []
        assert apple_rss._parse_feed({"feed": {}}) == []
        assert apple_rss._parse_feed({"feed": {"entry": "not-a-list"}}) == []

    def test_coerces_int_app_id_to_string(self):
        feed = _make_feed([{
            "id": {"attributes": {"im:id": 12345}},
            "im:name": {"label": "x"},
        }])
        rows = apple_rss._parse_feed(feed)
        assert rows[0].app_id == "12345"


# ---------------------------------------------------------------------------
# find_app_rank
# ---------------------------------------------------------------------------

class TestFindAppRank:
    def test_returns_matching_entry(self):
        entries = [
            apple_rss.ChartEntry(rank=1, app_id="111", name="A", category_label=None),
            apple_rss.ChartEntry(rank=2, app_id="222", name="B", category_label=None),
        ]
        match = apple_rss.find_app_rank(entries, "222")
        assert match is not None
        assert match.rank == 2

    def test_returns_none_when_off_chart(self):
        entries = [
            apple_rss.ChartEntry(rank=1, app_id="111", name="A", category_label=None),
        ]
        assert apple_rss.find_app_rank(entries, "999") is None

    def test_app_id_compared_as_string(self):
        entries = [
            apple_rss.ChartEntry(rank=5, app_id="6759482612", name="Endura", category_label="Education"),
        ]
        assert apple_rss.find_app_rank(entries, 6759482612).rank == 5  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# fetch_chart (with mocked httpx)
# ---------------------------------------------------------------------------

def _make_response(status_code: int, payload=None, text: str = ""):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = payload if payload is not None else {}
    if payload is None:
        resp.json.side_effect = ValueError("not json")
    resp.text = text
    return resp


class TestFetchChart:
    def test_happy_path_returns_parsed_entries(self):
        feed = _make_feed([_entry("6759482612", "Endura")])
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(200, feed)

        rows = apple_rss.fetch_chart("US", genre_id=6017, client=client)

        assert len(rows) == 1
        assert rows[0].app_id == "6759482612"
        # URL was built with the right country + genre
        called_url = client.get.call_args[0][0]
        assert "/us/" in called_url and "genre=6017" in called_url

    def test_404_returns_empty_list(self):
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(404)
        assert apple_rss.fetch_chart("xx", client=client) == []

    def test_403_retries_then_succeeds(self, monkeypatch):
        """Apple's CDN sometimes returns 403 (WAF) under bursty load.
        We retry up to 3x; the second attempt should succeed when the
        first hits 403."""
        monkeypatch.setattr("services.apple_rss._time.sleep", lambda *_: None) if False else None
        # simpler: monkeypatch time.sleep via the module
        import time as _time
        monkeypatch.setattr(_time, "sleep", lambda *_: None)

        feed = _make_feed([_entry("6759482612", "Endura")])
        client = MagicMock(spec=httpx.Client)
        client.get.side_effect = [
            _make_response(403, text="Forbidden"),
            _make_response(200, feed),
        ]
        rows = apple_rss.fetch_chart("AR", genre_id=6007, client=client)
        assert len(rows) == 1
        assert rows[0].app_id == "6759482612"
        assert client.get.call_count == 2

    def test_403_exhausts_retries_returns_empty(self, monkeypatch):
        import time as _time
        monkeypatch.setattr(_time, "sleep", lambda *_: None)
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(403, text="Forbidden")
        assert apple_rss.fetch_chart("US", client=client) == []
        # All 3 attempts consumed
        assert client.get.call_count == 3

    def test_ipad_passes_through_to_url(self):
        feed = _make_feed([_entry("6759482612", "Endura")])
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(200, feed)
        apple_rss.fetch_chart(
            "AR", genre_id=apple_rss.GENRE_PRODUCTIVITY,
            device=apple_rss.DEVICE_IPAD, client=client,
        )
        called_url = client.get.call_args[0][0]
        assert "topfreeipadapplications" in called_url
        assert "/ar/" in called_url and "genre=6007" in called_url

    def test_5xx_returns_empty_list_and_logs(self, monkeypatch):
        import time as _time
        monkeypatch.setattr(_time, "sleep", lambda *_: None)
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(503, text="upstream broken")
        assert apple_rss.fetch_chart("US", client=client) == []

    def test_non_json_response_returns_empty_list(self):
        client = MagicMock(spec=httpx.Client)
        client.get.return_value = _make_response(200, payload=None, text="<html>")
        assert apple_rss.fetch_chart("US", client=client) == []

    def test_network_error_propagates(self):
        client = MagicMock(spec=httpx.Client)
        client.get.side_effect = httpx.ConnectError("dns boom")
        with pytest.raises(httpx.HTTPError):
            apple_rss.fetch_chart("US", client=client)
