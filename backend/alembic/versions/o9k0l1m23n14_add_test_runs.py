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
    # Table may already exist (created by create_all before this migration was added).
    # Use raw SQL with IF NOT EXISTS so the migration is idempotent.
    op.execute("""
        CREATE TABLE IF NOT EXISTS test_runs (
            id SERIAL PRIMARY KEY,
            suite VARCHAR(20) NOT NULL,
            status VARCHAR(20) NOT NULL,
            exit_code INTEGER,
            passed INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            errors INTEGER DEFAULT 0,
            total INTEGER DEFAULT 0,
            duration_seconds FLOAT,
            started_at TIMESTAMP WITHOUT TIME ZONE,
            finished_at TIMESTAMP WITHOUT TIME ZONE,
            triggered_by VARCHAR,
            failed_tests TEXT,
            raw_summary TEXT
        )
    """)
    # Ensure indexes exist (also idempotent via IF NOT EXISTS).
    op.execute("CREATE INDEX IF NOT EXISTS ix_test_runs_id ON test_runs (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_test_runs_suite ON test_runs (suite)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_test_runs_status ON test_runs (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_test_runs_started_at ON test_runs (started_at)")


def downgrade():
    op.drop_table('test_runs')
