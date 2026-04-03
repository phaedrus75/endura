"""add shared eggs

Revision ID: fb5281d64f85
Revises: 1567004aca3b
Create Date: 2026-04-03 19:36:55.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'fb5281d64f85'
down_revision: Union[str, Sequence[str], None] = '1567004aca3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS shared_eggs (
            id SERIAL PRIMARY KEY,
            creator_id INTEGER NOT NULL REFERENCES users(id),
            partner_id INTEGER NOT NULL REFERENCES users(id),
            animal_name VARCHAR NOT NULL,
            status VARCHAR DEFAULT 'pending',
            creator_minutes INTEGER DEFAULT 0,
            partner_minutes INTEGER DEFAULT 0,
            minutes_required INTEGER DEFAULT 60,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            hatched_at TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_shared_eggs_id ON shared_eggs (id)")

    op.execute("""
        ALTER TABLE user_animals
        ADD COLUMN IF NOT EXISTS shared_with_user_id INTEGER REFERENCES users(id)
    """)
    op.execute("""
        ALTER TABLE user_animals
        ADD COLUMN IF NOT EXISTS shared_egg_id INTEGER REFERENCES shared_eggs(id)
    """)


def downgrade() -> None:
    op.drop_column('user_animals', 'shared_egg_id')
    op.drop_column('user_animals', 'shared_with_user_id')
    op.drop_table('shared_eggs')
