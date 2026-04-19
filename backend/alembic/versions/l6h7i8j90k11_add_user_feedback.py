"""add user_feedback + feedback_upvotes tables

Revision ID: l6h7i8j90k11
Revises: k5g6h7i89j10
Create Date: 2026-04-19 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'l6h7i8j90k11'
down_revision: Union[str, Sequence[str], None] = 'k5g6h7i89j10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_feedback (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            email           VARCHAR(255) NULL,
            feedback_type   VARCHAR(20) NOT NULL,
            title           VARCHAR(200) NULL,
            message         TEXT NOT NULL,
            app_version     VARCHAR(20) NULL,
            os              VARCHAR(40) NULL,
            device_model    VARCHAR(80) NULL,
            screen_context  VARCHAR(120) NULL,
            screenshot_url  VARCHAR(500) NULL,
            status          VARCHAR(20) NOT NULL DEFAULT 'new',
            priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
            admin_notes     TEXT NULL,
            internal_link   VARCHAR(300) NULL,
            upvotes         INTEGER NOT NULL DEFAULT 0,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            resolved_at     TIMESTAMP NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_feedback_user_id ON user_feedback (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_feedback_email ON user_feedback (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_feedback_type ON user_feedback (feedback_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_feedback_status ON user_feedback (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_feedback_created_at ON user_feedback (created_at DESC)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS feedback_upvotes (
            id              SERIAL PRIMARY KEY,
            feedback_id     INTEGER NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_feedback_upvote UNIQUE (feedback_id, user_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_upvotes_feedback ON feedback_upvotes (feedback_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_feedback_upvotes_user ON feedback_upvotes (user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS feedback_upvotes")
    op.execute("DROP TABLE IF EXISTS user_feedback")
