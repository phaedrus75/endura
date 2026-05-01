"""Add apple_id_sub / google_id_sub for OAuth merge-by-email."""

from alembic import op
import sqlalchemy as sa


revision = "x1y2z3a45b26"
down_revision = "w8x9y0z1a23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("apple_id_sub", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("google_id_sub", sa.String(length=255), nullable=True))
    op.create_index("ix_users_apple_id_sub", "users", ["apple_id_sub"], unique=True)
    op.create_index("ix_users_google_id_sub", "users", ["google_id_sub"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_google_id_sub", table_name="users")
    op.drop_index("ix_users_apple_id_sub", table_name="users")
    op.drop_column("users", "google_id_sub")
    op.drop_column("users", "apple_id_sub")
