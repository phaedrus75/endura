"""add users.onboarding_ab_variant for A/B funnel reporting

Revision ID: u6v7w8x9y21
Revises: t4p5q6r78s19
Create Date: 2026-04-28
"""
from alembic import op

revision = "u6v7w8x9y21"
down_revision = "t4p5q6r78s19"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_ab_variant VARCHAR(10) NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_users_onboarding_ab_variant ON users (onboarding_ab_variant)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_users_onboarding_ab_variant")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS onboarding_ab_variant")
