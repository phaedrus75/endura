"""Add study_sessions.abandoned_at column.

Why: PostHog data over Apr 22 – May 5 showed ~10% of every day's
session_started events end with the user explicitly tapping
"Abandon Egg" inside the app (the in-app modal is the strongest
"give up" signal we have). Today the client only fires a PostHog
event and clears local state — it never tells the backend — so
the row sits with completed_at IS NULL and the reaper finalises it
30 min later as a "saved you the work" auto-credit. Net: users who
explicitly chose to abandon are getting full coins/streak/totals
anyway, ~5,000+ phantom study minutes credited over 2 weeks, with
all the downstream metric distortion that implies.

This column lets us mark abandoned rows so the reaper can skip them
(no credit, no notification, no pending-hatch). Setting both
completed_at and abandoned_at also keeps the row out of the admin
"incomplete sessions" list — abandonment IS a completion event,
just one with zero credit.
"""

from alembic import op
import sqlalchemy as sa


revision = "b5c6d7e89f30"
down_revision = "a4b5c6d78e29"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("abandoned_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_study_sessions_abandoned_at",
        "study_sessions",
        ["abandoned_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_study_sessions_abandoned_at",
        table_name="study_sessions",
    )
    op.drop_column("study_sessions", "abandoned_at")
