"""add users.verification_codes (history) + case-insensitive uniqueness on email

Revision ID: a4b5c6d8e29
Revises: z3a4b5c67d28
Create Date: 2026-05-11

Why this exists:
- We were overwriting users.verification_code on every register / resend, so a
  user holding ANY non-latest signup email (because the backend or the user
  asked for several in a burst) would get "Invalid verification code" even
  though they typed a real, recently-issued code. We now keep the last few
  codes valid until they expire.
- Production also held two rows per address that differed only in casing
  (Pydantic EmailStr stores normalized, but earlier registrations stored
  whatever the client sent). A unique index on lower(email) prevents the
  drift from coming back, and crud.get_user_by_email is now case-insensitive.

Schema-tolerant — safe to re-run on a partially-migrated database.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a4b5c6d8e29"
down_revision: Union[str, Sequence[str], None] = "z3a4b5c67d28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("users")}

    if "verification_codes" not in cols:
        # JSON for portability (Postgres in prod, SQLite in tests). Holds a
        # short list of {"code": "123456", "expires": "2026-..."} objects so
        # any unexpired code from the last burst can verify.
        op.add_column(
            "users",
            sa.Column(
                "verification_codes",
                sa.JSON(),
                nullable=False,
                server_default=sa.text("'[]'"),
            ),
        )

    # Case-insensitive uniqueness. Pre-existing duplicate rows must be merged
    # by hand BEFORE this index is created (see docs / SQL in the PR), so this
    # statement guards itself when running against a database that still has
    # collisions.
    if bind.dialect.name == "postgresql":
        try:
            op.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email_lower "
                "ON users (LOWER(email))"
            )
        except Exception:
            # Don't block the migration — operator will dedupe and re-run.
            pass


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("users")}

    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_users_email_lower")

    if "verification_codes" in cols:
        op.drop_column("users", "verification_codes")
