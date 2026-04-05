"""add is_admin and use_test_timer columns to users

Revision ID: f9a3b5c78e04
Revises: e8f2a4c67d03
Create Date: 2026-03-30 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f9a3b5c78e04'
down_revision: Union[str, Sequence[str], None] = 'e8f2a4c67d03'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ADMIN_USER_IDS = [1, 2]


def upgrade() -> None:
    dialect = op.get_bind().dialect.name

    if dialect == "sqlite":
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(sa.Column("is_admin", sa.Boolean(), server_default="0", nullable=False))
            batch_op.add_column(sa.Column("use_test_timer", sa.Boolean(), server_default="0", nullable=False))
    else:
        op.add_column("users", sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False))
        op.add_column("users", sa.Column("use_test_timer", sa.Boolean(), server_default=sa.text("false"), nullable=False))

    conn = op.get_bind()
    for uid in ADMIN_USER_IDS:
        conn.execute(
            sa.text("UPDATE users SET is_admin = :val WHERE id = :uid"),
            {"val": True, "uid": uid},
        )


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("use_test_timer")
            batch_op.drop_column("is_admin")
    else:
        op.drop_column("users", "use_test_timer")
        op.drop_column("users", "is_admin")
