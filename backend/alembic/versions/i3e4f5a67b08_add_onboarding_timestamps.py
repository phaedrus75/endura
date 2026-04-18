"""add onboarding timestamps to users

Revision ID: i3e4f5a67b08
Revises: h2c3d4e56f06
Create Date: 2026-04-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'i3e4f5a67b08'
down_revision: Union[str, Sequence[str], None] = 'h2c3d4e56f06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS username_set_at TIMESTAMP NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS username_set_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_completed_at")
