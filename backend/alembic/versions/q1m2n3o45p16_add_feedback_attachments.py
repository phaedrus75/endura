"""add attachment_urls column to user_feedback

Stores a JSON-encoded list of upload URLs so a single feedback submission
can have multiple attached images. The legacy `screenshot_url` column is
preserved (kept in sync with attachment_urls[0] by the API layer) so older
admin views continue to render.

Revision ID: q1m2n3o45p16
Revises: p0l1m2n34o15
Create Date: 2026-04-27 22:30:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'q1m2n3o45p16'
down_revision: Union[str, Sequence[str], None] = 'p0l1m2n34o15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Wrapped in a try/except for SQLite test environments where ALTER TABLE
    # ADD COLUMN IF NOT EXISTS isn't supported. Postgres (production) handles
    # it natively.
    try:
        op.execute("ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS attachment_urls TEXT NULL")
    except Exception:
        op.execute("ALTER TABLE user_feedback ADD COLUMN attachment_urls TEXT NULL")


def downgrade() -> None:
    try:
        op.execute("ALTER TABLE user_feedback DROP COLUMN IF EXISTS attachment_urls")
    except Exception:
        op.execute("ALTER TABLE user_feedback DROP COLUMN attachment_urls")
