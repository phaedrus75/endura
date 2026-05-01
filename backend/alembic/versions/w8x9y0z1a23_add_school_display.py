"""add school_display table for per-school visibility tier on endura.eco

Drives the 3-row marquee on the marketing site: tier1/2/3 each render as a
separate row, 'hidden' suppresses junk values entirely. Default tier is
'tier3' so existing schools stay visible until an admin marks them.

Revision ID: w8x9y0z1a23
Revises: v7w8x9y0z22
Create Date: 2026-05-01
"""
from alembic import op


revision = "w8x9y0z1a23"
down_revision = "v7w8x9y0z22"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS school_display (
            id                  SERIAL PRIMARY KEY,
            name_key            VARCHAR(255) NOT NULL UNIQUE,
            school_name         VARCHAR(255) NOT NULL,
            country             VARCHAR(120) NULL,
            tier                VARCHAR(20)  NOT NULL DEFAULT 'tier3',
            updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
            updated_by_user_id  INTEGER      NULL REFERENCES users(id) ON DELETE SET NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_school_display_tier ON school_display (tier)"
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_school_display_tier")
    op.execute("DROP TABLE IF EXISTS school_display")
