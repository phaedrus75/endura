"""add subject column to study_groups

Revision ID: c4d8e2f19a01
Revises: a3c9f7e21b04
Create Date: 2026-03-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4d8e2f19a01'
down_revision: Union[str, Sequence[str], None] = 'a3c9f7e21b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS subject VARCHAR")


def downgrade() -> None:
    op.execute("ALTER TABLE study_groups DROP COLUMN IF EXISTS subject")
