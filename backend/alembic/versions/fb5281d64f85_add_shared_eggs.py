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
    op.create_table(
        'shared_eggs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('creator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('partner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('animal_name', sa.String(), nullable=False),
        sa.Column('status', sa.String(), server_default='pending'),
        sa.Column('creator_minutes', sa.Integer(), server_default='0'),
        sa.Column('partner_minutes', sa.Integer(), server_default='0'),
        sa.Column('minutes_required', sa.Integer(), server_default='60'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('hatched_at', sa.DateTime(), nullable=True),
    )

    op.add_column('user_animals',
        sa.Column('shared_with_user_id', sa.Integer(), nullable=True))
    op.add_column('user_animals',
        sa.Column('shared_egg_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_user_animals_shared_with', 'user_animals', 'users',
        ['shared_with_user_id'], ['id'])
    op.create_foreign_key(
        'fk_user_animals_shared_egg', 'user_animals', 'shared_eggs',
        ['shared_egg_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_user_animals_shared_egg', 'user_animals', type_='foreignkey')
    op.drop_constraint('fk_user_animals_shared_with', 'user_animals', type_='foreignkey')
    op.drop_column('user_animals', 'shared_egg_id')
    op.drop_column('user_animals', 'shared_with_user_id')
    op.drop_table('shared_eggs')
