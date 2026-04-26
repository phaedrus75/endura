"""add test_runs table

Revision ID: o9k0l1m23n14
Revises: n8j9k0l12m13
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'o9k0l1m23n14'
down_revision = 'n8j9k0l12m13'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'test_runs',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('suite', sa.String(20), nullable=False, index=True),
        sa.Column('status', sa.String(20), nullable=False, index=True),
        sa.Column('exit_code', sa.Integer(), nullable=True),
        sa.Column('passed', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('failed', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('errors', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('duration_seconds', sa.Float(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True, index=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('triggered_by', sa.String(), nullable=True),
        sa.Column('failed_tests', sa.Text(), nullable=True),
        sa.Column('raw_summary', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_table('test_runs')
