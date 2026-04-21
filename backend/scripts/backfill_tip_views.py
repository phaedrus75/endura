"""Backfill TipView rows from historical PostHog `tip_viewed` events.

Why: the mobile app only started writing views to our DB in commit 30b06bd
(app v1.0.3+). Users on older builds fired `tip_viewed` to PostHog but never
hit the backend. This script hydrates historical views into tip_views so
admin analytics + recap have real data from day one.

Usage (Railway shell):
    /opt/venv/bin/python -m scripts.backfill_tip_views

Required env:
    POSTHOG_PERSONAL_API_KEY   personal API key with project:read + query:read
    POSTHOG_PROJECT_ID         (optional) project id; auto-discovers if unset
    POSTHOG_HOST               (optional) defaults to https://us.posthog.com
    DATABASE_URL               already set on Railway

Idempotent: re-running won't double-insert. Existing TipView rows are left
alone (we keep the original viewed_at, liked, saved flags). Anonymous
distinct_ids and unknown user_ids/tip_ids are skipped.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

import httpx

# Make `backend/` importable when running as `python -m scripts.backfill_tip_views`
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import models  # noqa: E402
from database import SessionLocal  # noqa: E402


POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://us.posthog.com").rstrip("/")
PERSONAL_KEY = os.environ.get("POSTHOG_PERSONAL_API_KEY", "")
PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "")

# HogQL: earliest tip_viewed per (distinct_id, tip_id). Cast to ints for safety.
HOGQL = """
SELECT
    distinct_id,
    toInt64OrNull(properties.tip_id) AS tip_id,
    min(timestamp) AS first_viewed
FROM events
WHERE event = 'tip_viewed'
  AND properties.tip_id IS NOT NULL
GROUP BY distinct_id, tip_id
HAVING tip_id IS NOT NULL
ORDER BY first_viewed ASC
"""


def _headers() -> dict:
    if not PERSONAL_KEY:
        raise SystemExit("POSTHOG_PERSONAL_API_KEY env var is required")
    return {
        "Authorization": f"Bearer {PERSONAL_KEY}",
        "Content-Type": "application/json",
    }


def _resolve_project_id(client: httpx.Client) -> str:
    if PROJECT_ID:
        return PROJECT_ID
    r = client.get(f"{POSTHOG_HOST}/api/projects/", headers=_headers())
    r.raise_for_status()
    results = r.json().get("results", [])
    if not results:
        raise SystemExit("No PostHog projects accessible with this key")
    pid = str(results[0]["id"])
    print(f"[backfill] Auto-discovered PostHog project_id={pid}")
    return pid


def _query(client: httpx.Client, project_id: str) -> list[list]:
    print("[backfill] Querying PostHog for all-time tip_viewed events...")
    r = client.post(
        f"{POSTHOG_HOST}/api/projects/{project_id}/query/",
        headers=_headers(),
        json={"query": {"kind": "HogQLQuery", "query": HOGQL}},
        timeout=180.0,
    )
    r.raise_for_status()
    data = r.json()
    rows = data.get("results", [])
    print(f"[backfill] PostHog returned {len(rows)} (distinct_id, tip_id) pairs")
    return rows


def _parse_timestamp(raw) -> datetime:
    if isinstance(raw, datetime):
        return raw.replace(tzinfo=None) if raw.tzinfo else raw
    s = str(raw)
    if s.endswith("Z"):
        s = s[:-1]
    if "+" in s:
        s = s.split("+", 1)[0]
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return datetime.fromisoformat(s.split(".")[0])


def main() -> None:
    with httpx.Client() as client:
        project_id = _resolve_project_id(client)
        rows = _query(client, project_id)

    if not rows:
        print("[backfill] No events found. Nothing to do.")
        return

    db = SessionLocal()
    try:
        valid_user_ids = {u.id for u in db.query(models.User.id).all()}
        valid_tip_ids = {t.id for t in db.query(models.StudyTip.id).all()}
        print(
            f"[backfill] DB has {len(valid_user_ids)} users and {len(valid_tip_ids)} tips."
        )

        skipped_anon = skipped_unknown_user = skipped_unknown_tip = 0
        normalised: dict[tuple[int, int], datetime] = {}
        for row in rows:
            distinct_id, tip_id_raw, ts_raw = row[0], row[1], row[2]
            if distinct_id in (None, "anon", "anonymous"):
                skipped_anon += 1
                continue
            try:
                user_id = int(distinct_id)
            except (TypeError, ValueError):
                skipped_anon += 1
                continue
            if user_id not in valid_user_ids:
                skipped_unknown_user += 1
                continue
            try:
                tip_id = int(tip_id_raw)
            except (TypeError, ValueError):
                skipped_unknown_tip += 1
                continue
            if tip_id not in valid_tip_ids:
                skipped_unknown_tip += 1
                continue
            ts = _parse_timestamp(ts_raw)
            existing = normalised.get((user_id, tip_id))
            if existing is None or ts < existing:
                normalised[(user_id, tip_id)] = ts

        print(
            f"[backfill] After normalisation: {len(normalised)} valid (user,tip) pairs "
            f"(skipped: anon={skipped_anon}, unknown_user={skipped_unknown_user}, "
            f"unknown_tip={skipped_unknown_tip})"
        )

        if not normalised:
            print("[backfill] No valid pairs to write. Done.")
            return

        affected_user_ids = {u for u, _ in normalised.keys()}
        existing_views = db.query(models.TipView).filter(
            models.TipView.user_id.in_(affected_user_ids)
        ).all()
        existing_pairs = {(v.user_id, v.tip_id) for v in existing_views}

        created = skipped_existing = 0
        for (user_id, tip_id), ts in normalised.items():
            if (user_id, tip_id) in existing_pairs:
                skipped_existing += 1
                continue
            db.add(models.TipView(
                user_id=user_id,
                tip_id=tip_id,
                viewed_at=ts,
                liked=False,
                disliked=False,
                saved=False,
            ))
            created += 1

        db.commit()
        print(
            f"[backfill] Done. Created={created}, "
            f"SkippedExisting={skipped_existing}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
