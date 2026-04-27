"""backfill NULL total_study_minutes / current_streak / longest_streak to 0

Revision ID: p0l1m2n34o15
Revises: o9k0l1m23n14
Create Date: 2026-04-27

Background
----------
`Column(Integer, default=0)` in SQLAlchemy only fires on INSERT. Legacy rows
created before the default landed (or via raw SQL during early migrations)
can still hold NULL. The friends-leaderboard sort then crashes on
`None < int`, returning 500, which the mobile client silently swallows —
making the current user invisible on their own friends leaderboard.

This migration:
  1. Backfills NULLs to 0 for the integer counters that participate in
     leaderboard sorts and streak math.
  2. Hardens the columns to NOT NULL so future inserts can't reintroduce
     the same bug. The model defaults still apply at the ORM level.

Idempotent — `UPDATE ... WHERE x IS NULL` is a no-op once values are
backfilled, and `ALTER COLUMN ... SET NOT NULL` is a no-op once the
constraint is in place.
"""
from alembic import op


revision = 'p0l1m2n34o15'
down_revision = 'o9k0l1m23n14'
branch_labels = None
depends_on = None


COUNTER_COLUMNS = (
    "total_study_minutes",
    "current_streak",
    "longest_streak",
    "total_sessions",
    "weekly_goal_minutes",
)


def upgrade():
    for col in COUNTER_COLUMNS:
        # 1. Fill NULLs.
        op.execute(f"UPDATE users SET {col} = 0 WHERE {col} IS NULL")
        # 2. Lock the column down so this can't regress. Wrapped in a try
        #    so re-running the migration on a DB that's already NOT NULL
        #    doesn't error. Postgres-only; sqlite test DB ignores ALTER.
        try:
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} SET DEFAULT 0")
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} SET NOT NULL")
        except Exception:
            # SQLite (used in tests) doesn't support ALTER COLUMN; the
            # backfill above is enough for those environments.
            pass


def downgrade():
    for col in COUNTER_COLUMNS:
        try:
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} DROP NOT NULL")
        except Exception:
            pass
