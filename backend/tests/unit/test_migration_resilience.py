"""Regression test for the friends-leaderboard backfill migration
(`p0l1m2n34o15_backfill_user_minutes_null.py`).

Earlier this migration unconditionally referenced `users.weekly_goal_minutes`,
a column that has never existed on the production schema. Postgres rejected
the UPDATE, alembic raised, and the Railway deploy chain blocked seven
consecutive commits — including the leaderboard fix the migration was
created to support. This test prevents that class of bug from regressing.
"""
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from unittest.mock import MagicMock, patch


MIGRATION_PATH = (
    Path(__file__).parent.parent.parent
    / "alembic"
    / "versions"
    / "p0l1m2n34o15_backfill_user_minutes_null.py"
)


def _load_migration():
    """Load the migration module standalone.

    `alembic.op` is a runtime proxy that only resolves when invoked from
    inside an `alembic upgrade` context. When we load the migration file
    directly for unit testing, that import fails. We stub it with a
    MagicMock so the module-level `from alembic import op` succeeds; the
    individual tests then patch `op.get_bind` / `op.execute` as needed.
    """
    fake_op = MagicMock()
    if "alembic" not in sys.modules:
        fake_alembic = ModuleType("alembic")
        fake_alembic.op = fake_op  # type: ignore[attr-defined]
        sys.modules["alembic"] = fake_alembic
    else:
        sys.modules["alembic"].op = fake_op  # type: ignore[attr-defined]

    spec = importlib.util.spec_from_file_location("p0_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


class TestBackfillMigrationIsSchemaTolerant:
    def test_skips_columns_that_do_not_exist(self):
        """If introspection says a column isn't on the live `users` table,
        the migration must NOT emit any UPDATE / ALTER targeting it."""
        migration = _load_migration()

        executed_sql: list[str] = []
        bind = MagicMock()

        with patch.object(migration.op, "get_bind", return_value=bind), \
             patch.object(migration.op, "execute", side_effect=lambda sql: executed_sql.append(str(sql))), \
             patch.object(migration, "inspect") as mock_inspect:
            inspector = MagicMock()
            # Mimic a live DB that only has these columns — `weekly_goal_minutes`
            # is intentionally absent because that's the production reality
            # that broke the original migration.
            inspector.get_columns.return_value = [
                {"name": "id"},
                {"name": "total_study_minutes"},
                {"name": "current_streak"},
            ]
            mock_inspect.return_value = inspector
            migration.upgrade()

        joined = " ; ".join(executed_sql)
        # The migration must NOT touch columns the schema doesn't have.
        assert "weekly_goal_minutes" not in joined, (
            "Migration referenced a column missing from the live schema. "
            "This is exactly the bug that blocked seven Railway deploys. "
            f"Executed SQL was: {joined}"
        )
        assert "longest_streak" not in joined
        assert "total_sessions" not in joined
        # And it MUST still backfill the columns that ARE present.
        assert "total_study_minutes" in joined
        assert "current_streak" in joined

    def test_no_op_when_introspection_fails(self):
        """If the inspector itself raises (exotic dialect, perms, etc.),
        the migration must degrade to a no-op rather than crash the deploy."""
        migration = _load_migration()
        executed_sql: list[str] = []

        with patch.object(migration.op, "get_bind", return_value=MagicMock()), \
             patch.object(migration.op, "execute", side_effect=lambda sql: executed_sql.append(str(sql))), \
             patch.object(migration, "inspect") as mock_inspect:
            inspector = MagicMock()
            inspector.get_columns.side_effect = RuntimeError("introspection blew up")
            mock_inspect.return_value = inspector
            # Should not raise.
            migration.upgrade()

        assert executed_sql == [], (
            "Migration must not emit SQL when it can't introspect the schema."
        )

    def test_backfills_all_present_counter_columns(self):
        """Happy path: when every counter column exists (e.g. fresh test DB),
        the migration backfills all of them with `UPDATE … SET col = 0
        WHERE col IS NULL` so legacy NULLs can't crash leaderboard sorts."""
        migration = _load_migration()
        executed_sql: list[str] = []

        with patch.object(migration.op, "get_bind", return_value=MagicMock()), \
             patch.object(migration.op, "execute", side_effect=lambda sql: executed_sql.append(str(sql))), \
             patch.object(migration, "inspect") as mock_inspect:
            inspector = MagicMock()
            inspector.get_columns.return_value = [
                {"name": col} for col in migration.CANDIDATE_COLUMNS
            ]
            mock_inspect.return_value = inspector
            migration.upgrade()

        for col in migration.CANDIDATE_COLUMNS:
            assert any(
                f"UPDATE users SET {col} = 0 WHERE {col} IS NULL" in stmt
                for stmt in executed_sql
            ), f"Migration did not backfill `{col}` when present"
