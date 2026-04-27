"""add feedback_messages table for Intercom-style admin replies

Revision ID: r2n3o4p56q17
Revises: q1m2n3o45p16
Create Date: 2026-04-28

Schema-tolerant: skips create if the table already exists (idempotent deploys).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "r2n3o4p56q17"
down_revision: Union[str, Sequence[str], None] = "q1m2n3o45p16"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if insp.has_table("feedback_messages"):
        return
    op.create_table(
        "feedback_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False, primary_key=True),
        sa.Column("feedback_id", sa.Integer(), nullable=False),
        sa.Column("sender", sa.String(length=10), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["feedback_id"], ["user_feedback.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_feedback_messages_feedback_id"), "feedback_messages", ["feedback_id"], unique=False)
    op.create_index(op.f("ix_feedback_messages_read_at"), "feedback_messages", ["read_at"], unique=False)
    op.create_index(op.f("ix_feedback_messages_created_at"), "feedback_messages", ["created_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if not insp.has_table("feedback_messages"):
        return
    op.drop_table("feedback_messages")
