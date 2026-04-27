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

Idempotent and *schema-tolerant*: each column is only touched if it
actually exists on the live database, so older environments where some
columns were never added (or future cleanups that drop them) won't fail
the entire deploy.

Earlier this migration unconditionally referenced `weekly_goal_minutes`,
which has never existed on the production `users` table. That blocked
seven consecutive Railway deploys (commits 95427c5, fb4daf5, a84d4f2,
3fd1b2e, ddd818e, …) from shipping — including the friends-leaderboard
truncation fix this migration was created to support. Hence the
introspection check below.
"""
from alembic import op
from sqlalchemy import inspect


revision = 'p0l1m2n34o15'
down_revision = 'o9k0l1m23n14'
branch_labels = None
depends_on = None


# Columns we WANT to backfill if present. Anything not in the live schema
# is silently skipped — see module docstring for the war story.
CANDIDATE_COLUMNS = (
    "total_study_minutes",
    "current_streak",
    "longest_streak",
    "total_sessions",
)


def _existing_columns() -> set[str]:
    """Return the set of column names actually present on the live `users`
    table, in lowercase. Postgres returns lowercase; SQLite preserves case
    but the User model uses lowercase identifiers so a lowercase compare
    is consistent across both."""
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        return {col["name"].lower() for col in inspector.get_columns("users")}
    except Exception:
        # If introspection itself fails (e.g. exotic dialect), be safe and
        # treat every column as missing — the migration becomes a no-op
        # rather than crashing the deploy.
        return set()


def upgrade():
    present = _existing_columns()
    for col in CANDIDATE_COLUMNS:
        if col.lower() not in present:
            # Column doesn't exist on this DB — skip silently so we don't
            # block the deploy. The leaderboard NULL-coercion in
            # crud.get_leaderboard is the runtime backstop.
            continue
        # 1. Fill NULLs.
        op.execute(f"UPDATE users SET {col} = 0 WHERE {col} IS NULL")
        # 2. Lock the column down so this can't regress. Wrapped in a try
        #    because (a) re-running on a DB that's already NOT NULL is a
        #    no-op that some dialects still object to, and (b) sqlite
        #    (used in tests) doesn't support ALTER COLUMN ... SET NOT NULL.
        try:
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} SET DEFAULT 0")
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} SET NOT NULL")
        except Exception:
            pass


def downgrade():
    present = _existing_columns()
    for col in CANDIDATE_COLUMNS:
        if col.lower() not in present:
            continue
        try:
            op.execute(f"ALTER TABLE users ALTER COLUMN {col} DROP NOT NULL")
        except Exception:
            pass
