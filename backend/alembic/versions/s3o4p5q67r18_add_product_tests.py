"""add product_tests and product_test_events

Revision ID: s3o4p5q67r18
Revises: r2n3o4p56q17
Create Date: 2026-04-28
"""
from alembic import op

revision = "s3o4p5q67r18"
down_revision = "r2n3o4p56q17"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_tests (
            id SERIAL PRIMARY KEY,
            name VARCHAR(160) NOT NULL,
            feature_key VARCHAR(100) NOT NULL,
            hypothesis TEXT,
            success_metric VARCHAR(200),
            guardrail_metric VARCHAR(200),
            posthog_insight_url VARCHAR(500),
            control_label VARCHAR(80) NOT NULL DEFAULT 'v1',
            challenger_label VARCHAR(80) NOT NULL DEFAULT 'v2',
            winner VARCHAR(20),
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            sample_control INTEGER,
            sample_challenger INTEGER,
            conversion_control FLOAT,
            conversion_challenger FLOAT,
            guardrail_control FLOAT,
            guardrail_challenger FLOAT,
            started_at TIMESTAMP WITHOUT TIME ZONE,
            ended_at TIMESTAMP WITHOUT TIME ZONE,
            promoted_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS product_test_events (
            id SERIAL PRIMARY KEY,
            test_id INTEGER NOT NULL REFERENCES product_tests(id) ON DELETE CASCADE,
            event_type VARCHAR(40) NOT NULL,
            message TEXT,
            payload_json TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_id ON product_tests (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_feature_key ON product_tests (feature_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_status ON product_tests (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_created_at ON product_tests (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_started_at ON product_tests (started_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_ended_at ON product_tests (ended_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_tests_promoted_at ON product_tests (promoted_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_test_events_id ON product_test_events (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_test_events_test_id ON product_test_events (test_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_test_events_event_type ON product_test_events (event_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_product_test_events_created_at ON product_test_events (created_at)")


def downgrade():
    op.drop_table("product_test_events")
    op.drop_table("product_tests")

