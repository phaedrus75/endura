"""add security columns

Revision ID: a3c9f7e21b04
Revises: fb5281d64f85
Create Date: 2026-04-03 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3c9f7e21b04'
down_revision: Union[str, Sequence[str], None] = 'fb5281d64f85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_attempts INTEGER DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS verification_attempts")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS reset_attempts")
