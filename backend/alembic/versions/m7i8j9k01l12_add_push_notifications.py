"""add push notification infrastructure

- New columns on users for token metadata + per-category prefs
- push_templates: configurable lifecycle/campaign push messages
- push_logs: delivery tracking (mirrors email_logs)

Revision ID: m7i8j9k01l12
Revises: l6h7i8j90k11
Create Date: 2026-04-26 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'm7i8j9k01l12'
down_revision: Union[str, Sequence[str], None] = 'l6h7i8j90k11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Extra metadata + per-category prefs on users.
    # push_token / notification_enabled / study_reminder_hour already exist.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMP NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_platform VARCHAR(10) NULL")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_badges_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_friends_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_marketing_enabled BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_push_token ON users (push_token) WHERE push_token IS NOT NULL")

    # 2) push_templates
    op.execute("""
        CREATE TABLE IF NOT EXISTS push_templates (
            id              SERIAL PRIMARY KEY,
            template_key    VARCHAR(80) UNIQUE NOT NULL,
            name            VARCHAR(120) NOT NULL,
            title           VARCHAR(80) NOT NULL,
            body            VARCHAR(220) NOT NULL,
            category        VARCHAR(30) NOT NULL DEFAULT 'marketing',
            deep_link       VARCHAR(120) NULL,
            trigger_day     INTEGER NULL,
            inactive_days   INTEGER NULL,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_templates_key ON push_templates (template_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_templates_active ON push_templates (is_active)")

    # 3) push_logs
    op.execute("""
        CREATE TABLE IF NOT EXISTS push_logs (
            id                  SERIAL PRIMARY KEY,
            user_id             INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            push_token          VARCHAR(200) NULL,
            template_key        VARCHAR(80) NULL,
            category            VARCHAR(30) NULL,
            title               VARCHAR(200) NULL,
            body                VARCHAR(500) NULL,
            expo_ticket_id      VARCHAR(80) NULL,
            expo_receipt_id     VARCHAR(80) NULL,
            sent_at             TIMESTAMP NOT NULL DEFAULT NOW(),
            status              VARCHAR(20) NOT NULL DEFAULT 'sent',
            error_code          VARCHAR(80) NULL,
            error_message       VARCHAR(500) NULL,
            opened              BOOLEAN NOT NULL DEFAULT FALSE,
            opened_at           TIMESTAMP NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_logs_user ON push_logs (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_logs_template ON push_logs (template_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_logs_category ON push_logs (category)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_logs_sent_at ON push_logs (sent_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_push_logs_token ON push_logs (push_token)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS push_logs")
    op.execute("DROP TABLE IF EXISTS push_templates")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notif_marketing_enabled")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notif_reminders_enabled")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notif_friends_enabled")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS notif_badges_enabled")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS push_platform")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS push_token_updated_at")
