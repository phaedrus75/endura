"""Add study_sessions.auto_completed_at column for the server-side reaper.

The reaper job (Gap 2 fix) finalises rows that were started via
POST /sessions/start but never finished by the client (because the user
never reopened the app). It awards coins/streak to honour the work the
user actually did. We mark such rows with auto_completed_at so we can:
  - distinguish them in admin dashboards
  - avoid double-crediting if the client *does* eventually catch up
  - power "we auto-credited you" notifications later
"""

from alembic import op
import sqlalchemy as sa


revision = "y2z3a4b56c27"
down_revision = "x1y2z3a45b26"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("auto_completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_study_sessions_auto_completed_at",
        "study_sessions",
        ["auto_completed_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_study_sessions_auto_completed_at",
        table_name="study_sessions",
    )
    op.drop_column("study_sessions", "auto_completed_at")
