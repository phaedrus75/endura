"""add users.app_version / app_build / app_version_updated_at

Tracks the last app version each user was running so we can target
update-prompt emails at users on outdated builds. Refreshed on every
push-token registration (cold start) and via feedback submissions.

Revision ID: v7w8x9y0z22
Revises: u6v7w8x9y21
Create Date: 2026-05-01
"""
from alembic import op


revision = "v7w8x9y0z22"
down_revision = "u6v7w8x9y21"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version VARCHAR(20) NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS app_build VARCHAR(20) NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS app_version_updated_at TIMESTAMP NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_app_version ON users (app_version)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_users_app_version")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_version_updated_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_build")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS app_version")
