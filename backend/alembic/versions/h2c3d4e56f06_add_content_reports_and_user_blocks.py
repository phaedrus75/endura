"""add content_reports and user_blocks tables

Revision ID: h2c3d4e56f06
Revises: g1b2c3d45e05
Create Date: 2026-04-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'h2c3d4e56f06'
down_revision = 'g1b2c3d45e05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'content_reports',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reported_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), server_default='pending'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        'user_blocks',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('blocker_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('blocked_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint('blocker_id', 'blocked_id', name='uq_user_block'),
    )


def downgrade() -> None:
    op.drop_table('user_blocks')
    op.drop_table('content_reports')
