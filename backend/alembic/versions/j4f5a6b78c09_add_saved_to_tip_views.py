"""add saved + saved_at to tip_views

Revision ID: j4f5a6b78c09
Revises: i3e4f5a67b08
Create Date: 2026-04-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'j4f5a6b78c09'
down_revision: Union[str, Sequence[str], None] = 'i3e4f5a67b08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tip_views ADD COLUMN IF NOT EXISTS saved BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE tip_views ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tip_views_saved ON tip_views (saved) WHERE saved = TRUE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tip_views_saved_at ON tip_views (saved_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tip_views_saved_at")
    op.execute("DROP INDEX IF EXISTS ix_tip_views_saved")
    op.execute("ALTER TABLE tip_views DROP COLUMN IF EXISTS saved_at")
    op.execute("ALTER TABLE tip_views DROP COLUMN IF EXISTS saved")
