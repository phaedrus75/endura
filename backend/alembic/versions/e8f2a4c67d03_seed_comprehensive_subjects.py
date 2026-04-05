"""seed comprehensive subjects catalog

Revision ID: e8f2a4c67d03
Revises: d7a1b3e45f02
Create Date: 2026-03-30 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e8f2a4c67d03'
down_revision: Union[str, Sequence[str], None] = 'd7a1b3e45f02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_SUBJECTS = [
    # Mathematics
    ("further mathematics", "Further Mathematics"),
    ("statistics", "Statistics"),
    ("calculus", "Calculus"),
    # Natural Sciences
    ("environmental science", "Environmental Science"),
    ("earth science", "Earth Science"),
    ("marine science", "Marine Science"),
    ("geology", "Geology"),
    ("astronomy", "Astronomy"),
    ("anatomy and physiology", "Anatomy and Physiology"),
    ("forensic science", "Forensic Science"),
    ("biotechnology", "Biotechnology"),
    ("health science", "Health Science"),
    ("sports science", "Sports Science"),
    ("nutrition", "Nutrition"),
    ("agricultural science", "Agricultural Science"),
    # Social Sciences
    ("anthropology", "Anthropology"),
    ("social and cultural anthropology", "Social and Cultural Anthropology"),
    ("macroeconomics", "Macroeconomics"),
    ("microeconomics", "Microeconomics"),
    ("political science", "Political Science"),
    ("government and politics", "Government and Politics"),
    ("global politics", "Global Politics"),
    ("comparative government", "Comparative Government"),
    ("human geography", "Human Geography"),
    ("law", "Law"),
    ("criminology", "Criminology"),
    ("ethics", "Ethics"),
    ("religious studies", "Religious Studies"),
    ("world religions", "World Religions"),
    ("social studies", "Social Studies"),
    ("civics", "Civics"),
    # History
    ("us history", "US History"),
    ("world history", "World History"),
    ("european history", "European History"),
    ("art history", "Art History"),
    ("ancient history", "Ancient History"),
    # English & Language Arts
    ("english language", "English Language"),
    ("english literature", "English Literature"),
    ("creative writing", "Creative Writing"),
    ("media studies", "Media Studies"),
    ("journalism", "Journalism"),
    ("communication studies", "Communication Studies"),
    # World Languages
    ("mandarin chinese", "Mandarin Chinese"),
    ("japanese", "Japanese"),
    ("arabic", "Arabic"),
    ("hindi", "Hindi"),
    ("italian", "Italian"),
    ("portuguese", "Portuguese"),
    ("russian", "Russian"),
    ("latin", "Latin"),
    ("ancient greek", "Ancient Greek"),
    ("korean", "Korean"),
    ("urdu", "Urdu"),
    ("turkish", "Turkish"),
    ("dutch", "Dutch"),
    ("sanskrit", "Sanskrit"),
    ("hebrew", "Hebrew"),
    ("persian", "Persian"),
    ("polish", "Polish"),
    ("swedish", "Swedish"),
    ("sign language", "Sign Language"),
    # Arts
    ("visual arts", "Visual Arts"),
    ("music theory", "Music Theory"),
    ("theatre", "Theatre"),
    ("drama", "Drama"),
    ("dance", "Dance"),
    ("film studies", "Film Studies"),
    ("photography", "Photography"),
    ("graphic design", "Graphic Design"),
    ("painting", "Painting"),
    # Technology & Design
    ("design technology", "Design Technology"),
    ("information technology", "Information Technology"),
    ("digital technology", "Digital Technology"),
    ("engineering", "Engineering"),
    ("robotics", "Robotics"),
    # Business
    ("business management", "Business Management"),
    ("accounting", "Accounting"),
    ("accountancy", "Accountancy"),
    ("marketing", "Marketing"),
    ("finance", "Finance"),
    ("entrepreneurship", "Entrepreneurship"),
    ("commerce", "Commerce"),
    # IB-Specific
    ("theory of knowledge", "Theory of Knowledge"),
    ("environmental systems and societies", "Environmental Systems and Societies"),
    ("sports exercise and health science", "Sports Exercise and Health Science"),
    # CBSE / Indian Curriculum
    ("physical education", "Physical Education"),
    ("home science", "Home Science"),
    ("informatics practices", "Informatics Practices"),
    ("legal studies", "Legal Studies"),
    # AP-Specific
    ("ap seminar", "AP Seminar"),
    ("ap research", "AP Research"),
    # Entrance Exams & Test Prep
    ("sat", "SAT"),
    ("act", "ACT"),
    ("mcat", "MCAT"),
    ("lsat", "LSAT"),
    ("gre", "GRE"),
    ("gmat", "GMAT"),
    ("ucat", "UCAT"),
    ("bmat", "BMAT"),
    ("lnat", "LNAT"),
    ("step", "STEP"),
    ("mat", "MAT"),
    ("pat", "PAT"),
    ("tsa", "TSA"),
    ("ielts", "IELTS"),
    ("toefl", "TOEFL"),
    ("ap exam prep", "AP Exam Prep"),
    ("common app", "Common App"),
    ("ucas", "UCAS"),
    ("jee", "JEE"),
    ("neet", "NEET"),
    ("gamsat", "GAMSAT"),
    ("dat", "DAT"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for name, display_name in NEW_SUBJECTS:
        exists = conn.execute(
            sa.text("SELECT 1 FROM subjects WHERE name = :n"), {"n": name}
        ).fetchone()
        if not exists:
            conn.execute(
                sa.text(
                    "INSERT INTO subjects (name, display_name, is_default) "
                    "VALUES (:n, :d, 1)"
                ),
                {"n": name, "d": display_name},
            )


def downgrade() -> None:
    conn = op.get_bind()
    names = [n for n, _ in NEW_SUBJECTS]
    for name in names:
        conn.execute(
            sa.text("DELETE FROM subjects WHERE name = :n AND is_default = 1"),
            {"n": name},
        )
