"""Add study_sessions.intended_animal_name column.

Why: when a user starts a focus session they pick which animal they're
working toward. Today we send that pick to POST /sessions/start but the
backend silently throws it away — the animal only gets persisted at
hatch time inside the UserAnimal row.

That gap surfaced in the build-34 "hatch on next launch" recovery flow:
when the reaper auto-completes a stale session and the user comes back
to hatch, we have no idea what they originally picked, so we have to
ask them all over again. Day-1 UX feedback flagged this as confusing
("shouldn't it be the animal I picked earlier?").

This column lets us remember the user's pick at start-time and pre-fill
the recovery hatch with the right animal. Nullable because (a) all
historic rows have no record of the original pick and (b) the legacy
POST /sessions path completes-and-hatches in one shot, so the column
isn't needed there.
"""

from alembic import op
import sqlalchemy as sa


revision = "a4b5c6d78e29"
down_revision = "z3a4b5c67d28"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("intended_animal_name", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("study_sessions", "intended_animal_name")
