"""add user_purchases and user_item_assignments tables

Revision ID: g1b2c3d45e05
Revises: f9a3b5c78e04
Create Date: 2026-03-30 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'g1b2c3d45e05'
down_revision = 'f9a3b5c78e04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_purchases',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('item_key', sa.String(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('purchased_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'item_key', name='uq_user_purchase'),
    )

    op.create_table(
        'user_item_assignments',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('item_id', sa.String(), nullable=False),
        sa.Column('x', sa.Float(), nullable=False),
        sa.Column('y', sa.Float(), nullable=False),
        sa.Column('page', sa.Integer(), server_default='0'),
        sa.UniqueConstraint('user_id', 'item_id', name='uq_user_item_assignment'),
    )


def downgrade() -> None:
    op.drop_table('user_item_assignments')
    op.drop_table('user_purchases')
