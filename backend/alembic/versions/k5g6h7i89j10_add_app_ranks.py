"""add app_ranks table

Revision ID: k5g6h7i89j10
Revises: j4f5a6b78c09
Create Date: 2026-04-19 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'k5g6h7i89j10'
down_revision: Union[str, Sequence[str], None] = 'j4f5a6b78c09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS app_ranks (
            id              SERIAL PRIMARY KEY,
            rank_date       TIMESTAMP NOT NULL,
            country         VARCHAR(2) NOT NULL,
            category_name   VARCHAR(120) NOT NULL,
            subtype         VARCHAR(20) NOT NULL,
            device          VARCHAR(20) NULL,
            store           VARCHAR(40) NULL,
            position        INTEGER NOT NULL,
            delta           INTEGER NULL,
            fetched_at      TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_app_ranks_rank_date ON app_ranks (rank_date)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_app_ranks_country ON app_ranks (country)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_app_ranks_country_date ON app_ranks (country, rank_date DESC)")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_app_ranks_slot
        ON app_ranks (rank_date, country, category_name, subtype, COALESCE(device, ''))
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_app_ranks_slot")
    op.execute("DROP INDEX IF EXISTS ix_app_ranks_country_date")
    op.execute("DROP INDEX IF EXISTS ix_app_ranks_country")
    op.execute("DROP INDEX IF EXISTS ix_app_ranks_rank_date")
    op.execute("DROP TABLE IF EXISTS app_ranks")
