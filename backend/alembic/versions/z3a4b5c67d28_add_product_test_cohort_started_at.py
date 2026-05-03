"""Add product_tests.cohort_started_at column.

Why: the funnel cohort for onboarding A/B tests was previously bypassing
date filtering entirely (admin clicks "running" → started_at := now() →
filtering by started_at would zero the cohort because all signups
predate it). The bypass produced inflated, contaminated cohorts that
mixed pre-experiment signups (who got assigned a variant when they
upgraded) with users who actually experienced the variant during
onboarding.

cohort_started_at lets the admin explicitly set the date the variant
first reached production users (e.g. 2026-05-01 for the v1/v2 test).
_funnel_arm_counts uses it as a hard floor when present, giving an
honest A/B comparison without losing the "fall back to all-time" behaviour
when it isn't set.
"""

from alembic import op
import sqlalchemy as sa


revision = "z3a4b5c67d28"
down_revision = "y2z3a4b56c27"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "product_tests",
        sa.Column("cohort_started_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("product_tests", "cohort_started_at")
