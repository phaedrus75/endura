"""add research surveys + consent fields

Revision ID: t4p5q6r78s19
Revises: s3o4p5q67r18
Create Date: 2026-04-28
"""
from alembic import op

revision = "t4p5q6r78s19"
down_revision = "s3o4p5q67r18"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS research_consent BOOLEAN")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS research_consent_at TIMESTAMP WITHOUT TIME ZONE")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS research_surveys (
            id SERIAL PRIMARY KEY,
            survey_key VARCHAR(100) NOT NULL UNIQUE,
            title VARCHAR(160) NOT NULL,
            description TEXT,
            intro_text TEXT,
            thank_you_text TEXT,
            trigger_type VARCHAR(30) NOT NULL DEFAULT 'manual',
            trigger_days_after_signup INTEGER,
            cooldown_days INTEGER NOT NULL DEFAULT 14,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS research_survey_questions (
            id SERIAL PRIMARY KEY,
            survey_id INTEGER NOT NULL REFERENCES research_surveys(id) ON DELETE CASCADE,
            question_key VARCHAR(80) NOT NULL,
            prompt TEXT NOT NULL,
            question_type VARCHAR(30) NOT NULL,
            options_json TEXT,
            is_required BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS research_survey_assignments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            survey_id INTEGER NOT NULL REFERENCES research_surveys(id) ON DELETE CASCADE,
            status VARCHAR(30) NOT NULL DEFAULT 'assigned',
            trigger_reason VARCHAR(80),
            assigned_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            shown_at TIMESTAMP WITHOUT TIME ZONE,
            started_at TIMESTAMP WITHOUT TIME ZONE,
            submitted_at TIMESTAMP WITHOUT TIME ZONE,
            dismissed_at TIMESTAMP WITHOUT TIME ZONE,
            snoozed_until TIMESTAMP WITHOUT TIME ZONE,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_research_assignment_user_survey UNIQUE (user_id, survey_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS research_survey_responses (
            id SERIAL PRIMARY KEY,
            assignment_id INTEGER NOT NULL REFERENCES research_survey_assignments(id) ON DELETE CASCADE,
            survey_id INTEGER NOT NULL REFERENCES research_surveys(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            question_id INTEGER NOT NULL REFERENCES research_survey_questions(id) ON DELETE CASCADE,
            answer_json TEXT NOT NULL,
            submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_research_surveys_id ON research_surveys (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_surveys_survey_key ON research_surveys (survey_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_questions_id ON research_survey_questions (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_questions_survey_id ON research_survey_questions (survey_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_id ON research_survey_assignments (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_user_id ON research_survey_assignments (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_survey_id ON research_survey_assignments (survey_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_status ON research_survey_assignments (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_assigned_at ON research_survey_assignments (assigned_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_assignments_snoozed_until ON research_survey_assignments (snoozed_until)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_id ON research_survey_responses (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_assignment_id ON research_survey_responses (assignment_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_survey_id ON research_survey_responses (survey_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_user_id ON research_survey_responses (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_question_id ON research_survey_responses (question_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_research_survey_responses_submitted_at ON research_survey_responses (submitted_at)")


def downgrade():
    op.drop_table("research_survey_responses")
    op.drop_table("research_survey_assignments")
    op.drop_table("research_survey_questions")
    op.drop_table("research_surveys")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS research_consent_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS research_consent")

