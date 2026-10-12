"""merge heads: verification_codes_history + session_abandoned_at

Revision ID: c7d8e9f01a30
Revises: a4b5c6d8e29, b5c6d7e89f30
Create Date: 2026-10-12

Why this exists:
Two migrations landed in parallel on main, both with
down_revision = "z3a4b5c67d28", creating two Alembic heads:

  z3a4b5c67d28 ──┬── a4b5c6d8e29  (verification_codes_history)
                 └── a4b5c6d78e29 ── b5c6d7e89f30  (session_abandoned_at)

Railway's deploy command runs `alembic upgrade head`, which fails on
"Multiple head revisions are present for given argument 'head'". Every
backend deploy since May 10 2026 has failed at this step; the service
has been running the May 10 image the whole time. This revision has no
schema work of its own — it just merges the two heads so Alembic has
a single target again and deploys can land.
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


revision: str = "c7d8e9f01a30"
down_revision: Union[str, Sequence[str], None] = ("a4b5c6d8e29", "b5c6d7e89f30")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge-only migration: no schema changes.
    pass


def downgrade() -> None:
    # Merge-only migration: no schema changes to reverse.
    pass
