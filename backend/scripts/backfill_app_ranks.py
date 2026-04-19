"""Backfill app_ranks from AppFigures historical data.

Why: the daily cron only fetches recent days. Run this once to pull as much
history as AppFigures retains (typically 90+ days).

Usage (Railway shell):
    python -m scripts.backfill_app_ranks                  # last 90 days
    python -m scripts.backfill_app_ranks --days 180       # last 180 days
    python -m scripts.backfill_app_ranks --days 30        # last month only

Required env (already set on Railway if rankings tab works):
    APPFIGURES_PAT             personal access token (public:read + products:read)
    APPFIGURES_APPSTORE_ID     iTunes app id (or APPFIGURES_PRODUCT_ID)
    DATABASE_URL               already set on Railway

Idempotent: existing rows for the same (date, country, category, subtype, device)
slot are updated in place, not duplicated. Run as often as you want.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from database import SessionLocal  # noqa: E402
from main import _sync_app_ranks   # noqa: E402  (reuses the app's helper)


CHUNK_DAYS = 30


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill AppFigures rankings into app_ranks")
    parser.add_argument("--days", type=int, default=90, help="How many days back to fetch (default 90)")
    args = parser.parse_args()

    today = datetime.utcnow().date()
    start = today - timedelta(days=args.days)
    print(f"Backfilling app_ranks from {start} to {today} ({args.days} days)…")

    totals = {"inserted": 0, "updated": 0, "skipped": 0}
    pruned_all: set[str] = set()

    db = SessionLocal()
    try:
        cursor = start
        while cursor < today:
            chunk_end = min(cursor + timedelta(days=CHUNK_DAYS), today)
            print(f"  → chunk {cursor} → {chunk_end}", flush=True)
            try:
                result = _sync_app_ranks(cursor, chunk_end, db)
            except Exception as e:
                print(f"  ! chunk failed: {e}", flush=True)
                cursor = chunk_end
                continue
            for k in totals:
                totals[k] += result.get(k, 0)
            for c in result.get("pruned_countries", []):
                pruned_all.add(c)
            print(
                f"    inserted={result['inserted']} updated={result['updated']} "
                f"skipped={result['skipped']}",
                flush=True,
            )
            cursor = chunk_end
    finally:
        db.close()

    print("\nDone.")
    print(f"  Total inserted: {totals['inserted']}")
    print(f"  Total updated:  {totals['updated']}")
    print(f"  Total skipped:  {totals['skipped']}")
    if pruned_all:
        print(f"  Unsupported countries (pruned): {sorted(pruned_all)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
