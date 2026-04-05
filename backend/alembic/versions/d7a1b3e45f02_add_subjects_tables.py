"""add subjects and user_subjects tables, migrate subject strings to FKs

Revision ID: d7a1b3e45f02
Revises: c4d8e2f19a01
Create Date: 2026-03-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7a1b3e45f02'
down_revision: Union[str, Sequence[str], None] = 'c4d8e2f19a01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_SUBJECTS = [
    ("math", "Math"),
    ("science", "Science"),
    ("english", "English"),
    ("history", "History"),
    ("physics", "Physics"),
    ("chemistry", "Chemistry"),
    ("biology", "Biology"),
    ("geography", "Geography"),
    ("computer science", "Computer Science"),
    ("economics", "Economics"),
    ("psychology", "Psychology"),
    ("art", "Art"),
    ("music", "Music"),
    ("french", "French"),
    ("spanish", "Spanish"),
    ("german", "German"),
    ("philosophy", "Philosophy"),
    ("business studies", "Business Studies"),
    ("sociology", "Sociology"),
    ("literature", "Literature"),
]


def upgrade() -> None:
    # 1. Create subjects table
    op.create_table(
        "subjects",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String, unique=True, nullable=False, index=True),
        sa.Column("display_name", sa.String, nullable=False),
        sa.Column("is_default", sa.Boolean, server_default="true"),
        sa.Column("created_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    # 2. Create user_subjects table
    op.create_table(
        "user_subjects",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("subject_id", sa.Integer, sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("added_at", sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "subject_id", name="uq_user_subject"),
    )

    # 3. Seed default subjects
    subjects_table = sa.table(
        "subjects",
        sa.column("name", sa.String),
        sa.column("display_name", sa.String),
        sa.column("is_default", sa.Boolean),
    )
    op.bulk_insert(subjects_table, [
        {"name": name, "display_name": display, "is_default": True}
        for name, display in DEFAULT_SUBJECTS
    ])

    # 4. Add subject_id FK to study_sessions
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        op.add_column("study_sessions", sa.Column("subject_id", sa.Integer, nullable=True))
    else:
        op.add_column(
            "study_sessions",
            sa.Column("subject_id", sa.Integer, sa.ForeignKey("subjects.id"), nullable=True),
        )

    # 5. Add subject_id FK to study_groups
    if dialect == "sqlite":
        op.add_column("study_groups", sa.Column("subject_id", sa.Integer, nullable=True))
    else:
        op.add_column(
            "study_groups",
            sa.Column("subject_id", sa.Integer, sa.ForeignKey("subjects.id"), nullable=True),
        )

    # 6. Create custom subjects from existing session strings not in defaults
    op.execute("""
        INSERT INTO subjects (name, display_name, is_default)
        SELECT DISTINCT lower(trim(ss.subject)), trim(ss.subject), false
        FROM study_sessions ss
        WHERE ss.subject IS NOT NULL
          AND lower(trim(ss.subject)) NOT IN (SELECT name FROM subjects)
    """)

    # 7. Create custom subjects from existing group strings not in defaults
    op.execute("""
        INSERT INTO subjects (name, display_name, is_default)
        SELECT DISTINCT lower(trim(sg.subject)), trim(sg.subject), false
        FROM study_groups sg
        WHERE sg.subject IS NOT NULL
          AND lower(trim(sg.subject)) NOT IN (SELECT name FROM subjects)
    """)

    # 8. Backfill study_sessions.subject_id
    op.execute("""
        UPDATE study_sessions
        SET subject_id = (
            SELECT s.id FROM subjects s
            WHERE s.name = lower(trim(study_sessions.subject))
            LIMIT 1
        )
        WHERE study_sessions.subject IS NOT NULL
    """)

    # 9. Backfill study_groups.subject_id
    op.execute("""
        UPDATE study_groups
        SET subject_id = (
            SELECT s.id FROM subjects s
            WHERE s.name = lower(trim(study_groups.subject))
            LIMIT 1
        )
        WHERE study_groups.subject IS NOT NULL
    """)

    # 10. Backfill user_subjects from session subjects
    op.execute("""
        INSERT INTO user_subjects (user_id, subject_id, is_active)
        SELECT DISTINCT ss.user_id, ss.subject_id, true
        FROM study_sessions ss
        WHERE ss.subject_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM user_subjects us
            WHERE us.user_id = ss.user_id AND us.subject_id = ss.subject_id
        )
    """)

    # 11. For users with no subjects, give them the 4 defaults
    op.execute("""
        INSERT INTO user_subjects (user_id, subject_id, is_active)
        SELECT u.id, s.id, true
        FROM users u
        CROSS JOIN subjects s
        WHERE s.name IN ('math', 'science', 'english', 'history')
          AND NOT EXISTS (
              SELECT 1 FROM user_subjects us WHERE us.user_id = u.id
          )
    """)

    # 12. Drop old string columns
    if dialect == "sqlite":
        with op.batch_alter_table("study_sessions") as batch:
            batch.drop_column("subject")
        with op.batch_alter_table("study_groups") as batch:
            batch.drop_column("subject")
    else:
        op.drop_column("study_sessions", "subject")
        op.drop_column("study_groups", "subject")


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        with op.batch_alter_table("study_groups") as batch:
            batch.add_column(sa.Column("subject", sa.String, nullable=True))
        with op.batch_alter_table("study_sessions") as batch:
            batch.add_column(sa.Column("subject", sa.String, nullable=True))
    else:
        op.add_column("study_groups", sa.Column("subject", sa.String, nullable=True))
        op.add_column("study_sessions", sa.Column("subject", sa.String, nullable=True))

    # Restore string values from subjects table
    op.execute("""
        UPDATE study_sessions
        SET subject = (
            SELECT s.display_name FROM subjects s WHERE s.id = study_sessions.subject_id
        )
        WHERE study_sessions.subject_id IS NOT NULL
    """)
    op.execute("""
        UPDATE study_groups
        SET subject = (
            SELECT s.display_name FROM subjects s WHERE s.id = study_groups.subject_id
        )
        WHERE study_groups.subject_id IS NOT NULL
    """)

    if dialect == "sqlite":
        with op.batch_alter_table("study_groups") as batch:
            batch.drop_column("subject_id")
        with op.batch_alter_table("study_sessions") as batch:
            batch.drop_column("subject_id")
    else:
        op.drop_column("study_groups", "subject_id")
        op.drop_column("study_sessions", "subject_id")

    op.drop_table("user_subjects")
    op.drop_table("subjects")
