"""Apple iTunes RSS marketing feeds — free, public, no-auth replacement
for AppFigures rank tracking.

Endpoint shape (stable since the late 2000s, still served as of 2026):

    https://itunes.apple.com/{country}/rss/topfreeapplications
        /limit={N}/genre={GENRE_ID}/json

Returns a JSON envelope where ``feed.entry`` is a rank-ordered list of apps:

    {
      "feed": {
        "entry": [
          {
            "id": {"attributes": {"im:id": "6759482612"}},
            "im:name": {"label": "Endura"},
            "category": {"attributes": {"label": "Education"}},
            ...
          },
          ...
        ]
      }
    }

Apple removed the "grossing" chart from this feed years ago, so we only
support free + paid subtypes here. For Endura (free app) only "free" is
useful in practice, but we keep "paid" callable for future-proofing.

Genre IDs we care about:
    6017  Education      — Endura's primary chart
    6007  Productivity   — many study apps cross-chart here
    (None) → top free overall (no genre filter)

If the app id is not found in a chart, ``find_app_rank`` returns ``None``
(off-chart) — the caller treats that as "skip this slot".
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional

import httpx

logger = logging.getLogger(__name__)

# Public iTunes RSS host. The newer rss.applemarketingtools.com host returns
# a similar shape but does NOT support the genre query param, so we stick
# with the legacy host that does.
RSS_BASE = "https://itunes.apple.com"

# Default request timeout. Apple's RSS endpoint is generally very fast
# (<500ms) but we leave headroom for tail latency.
DEFAULT_TIMEOUT = 15.0

# Genre IDs we expose as named constants for callers.
GENRE_EDUCATION = 6017
GENRE_PRODUCTIVITY = 6007

SUBTYPE_FREE = "free"
SUBTYPE_PAID = "paid"

_SUBTYPE_TO_FEED = {
    SUBTYPE_FREE: "topfreeapplications",
    SUBTYPE_PAID: "toppaidapplications",
}


@dataclass(frozen=True)
class ChartEntry:
    """One row in a chart, ordered by ``rank`` (1-indexed)."""

    rank: int
    app_id: str
    name: str
    category_label: Optional[str]


def _build_url(country: str, subtype: str, limit: int, genre_id: Optional[int]) -> str:
    feed = _SUBTYPE_TO_FEED.get(subtype)
    if not feed:
        raise ValueError(f"Unsupported subtype {subtype!r} (use 'free' or 'paid')")
    if not 1 <= limit <= 200:
        raise ValueError("limit must be between 1 and 200 (Apple caps at 200)")
    parts = [f"limit={limit}"]
    if genre_id is not None:
        parts.append(f"genre={genre_id}")
    return f"{RSS_BASE}/{country.lower()}/rss/{feed}/" + "/".join(parts) + "/json"


def fetch_chart(
    country: str,
    *,
    subtype: str = SUBTYPE_FREE,
    genre_id: Optional[int] = None,
    limit: int = 200,
    client: Optional[httpx.Client] = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> list[ChartEntry]:
    """Fetch one App Store chart and return its entries in rank order.

    Returns an empty list if Apple replies with 404 (chart not available
    for this country/genre — common for smaller storefronts) or if the
    response shape is unexpected. Network errors propagate.
    """
    url = _build_url(country, subtype, limit, genre_id)
    owns_client = client is None
    c = client or httpx.Client(timeout=timeout)
    try:
        try:
            r = c.get(url)
        except httpx.HTTPError as e:
            logger.warning("apple_rss network error %s %s: %s", country, genre_id, e)
            raise
        if r.status_code == 404:
            return []
        if r.status_code >= 400:
            logger.warning(
                "apple_rss HTTP %s for %s/%s: %s",
                r.status_code, country, genre_id, (r.text or "")[:200],
            )
            return []
        try:
            data = r.json()
        except ValueError:
            logger.warning("apple_rss non-JSON response for %s/%s", country, genre_id)
            return []
    finally:
        if owns_client:
            c.close()

    return _parse_feed(data)


def _parse_feed(data: dict) -> list[ChartEntry]:
    """Parse the iTunes RSS JSON envelope into ChartEntry rows."""
    feed = data.get("feed") if isinstance(data, dict) else None
    entries = feed.get("entry") if isinstance(feed, dict) else None
    if not isinstance(entries, list):
        return []

    out: list[ChartEntry] = []
    for idx, entry in enumerate(entries, start=1):
        if not isinstance(entry, dict):
            continue
        app_id = _extract_app_id(entry)
        if not app_id:
            continue
        name = _extract_label(entry.get("im:name")) or ""
        category = _extract_attr(entry.get("category"), "label")
        out.append(
            ChartEntry(
                rank=idx,
                app_id=app_id,
                name=name,
                category_label=category,
            )
        )
    return out


def _extract_app_id(entry: dict) -> Optional[str]:
    id_node = entry.get("id")
    if isinstance(id_node, dict):
        attrs = id_node.get("attributes")
        if isinstance(attrs, dict):
            v = attrs.get("im:id")
            if isinstance(v, (str, int)):
                return str(v)
    return None


def _extract_label(node) -> Optional[str]:
    if isinstance(node, dict):
        v = node.get("label")
        if isinstance(v, str):
            return v
    return None


def _extract_attr(node, key: str) -> Optional[str]:
    if isinstance(node, dict):
        attrs = node.get("attributes")
        if isinstance(attrs, dict):
            v = attrs.get(key)
            if isinstance(v, str):
                return v
    return None


def find_app_rank(
    entries: Iterable[ChartEntry], app_id: str
) -> Optional[ChartEntry]:
    """Return the entry whose ``app_id`` matches, or ``None`` if off-chart."""
    target = str(app_id)
    for e in entries:
        if e.app_id == target:
            return e
    return None
