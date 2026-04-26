"""add bounced complained to email_logs

Revision ID: n8j9k0l12m13
Revises: m7i8j9k01l12
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = 'n8j9k0l12m13'
down_revision = 'm7i8j9k01l12'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('email_logs') as batch_op:
        batch_op.add_column(sa.Column('bounced', sa.Boolean(), nullable=True, server_default='false'))
        batch_op.add_column(sa.Column('complained', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    with op.batch_alter_table('email_logs') as batch_op:
        batch_op.drop_column('complained')
        batch_op.drop_column('bounced')
