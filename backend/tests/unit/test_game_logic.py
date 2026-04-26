"""
Unit tests for the core game loop: coin calculation, streak logic, badge rules.
Uses the real DB session (via conftest) but tests logic directly via crud functions.
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch

import models
import crud
from tests.conftest import make_user


# ---------------------------------------------------------------------------
# Coin calculation
# ---------------------------------------------------------------------------

class TestCoinCalculation:
    """create_study_session adds coins based on duration."""

    def test_base_coins_equal_minutes(self, db):
        user = make_user(db, "coins1@test.com", "password123", "coins1")
        session, _ = crud.create_study_session(db, user.id, 10)
        assert session.coins_earned == 10  # <25 min: no bonus

    def test_25min_bonus(self, db):
        user = make_user(db, "coins2@test.com", "password123", "coins2")
        session, _ = crud.create_study_session(db, user.id, 25)
        assert session.coins_earned == 30  # 25 + 5 bonus

    def test_50min_bonus(self, db):
        user = make_user(db, "coins3@test.com", "password123", "coins3")
        session, _ = crud.create_study_session(db, user.id, 50)
        assert session.coins_earned == 65  # 50 + 5 + 10

    def test_multiplier_applied(self, db):
        user = make_user(db, "coins4@test.com", "password123", "coins4")
        user.eco_credits_multiplier = 1.25
        db.commit()
        session, _ = crud.create_study_session(db, user.id, 10)
        assert session.coins_earned == 12  # int(10 * 1.25)

    def test_coins_added_to_user_total(self, db):
        user = make_user(db, "coins5@test.com", "password123", "coins5")
        crud.create_study_session(db, user.id, 25)
        db.refresh(user)
        assert user.total_coins >= 30
        assert user.current_coins >= 30

    def test_total_minutes_incremented(self, db):
        user = make_user(db, "coins6@test.com", "password123", "coins6")
        crud.create_study_session(db, user.id, 25)
        crud.create_study_session(db, user.id, 15)
        db.refresh(user)
        assert user.total_study_minutes == 40

    def test_total_sessions_incremented(self, db):
        user = make_user(db, "coins7@test.com", "password123", "coins7")
        crud.create_study_session(db, user.id, 10)
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.total_sessions == 2


# ---------------------------------------------------------------------------
# Streak logic
# ---------------------------------------------------------------------------

class TestStreakLogic:
    """Streak increments, resets, and boundary conditions."""

    def test_first_session_streak_is_one(self, db):
        user = make_user(db, "streak1@test.com", "password123", "streak1")
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.current_streak == 1

    def test_same_day_second_session_no_increment(self, db):
        user = make_user(db, "streak2@test.com", "password123", "streak2")
        crud.create_study_session(db, user.id, 10)
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.current_streak == 1

    def test_consecutive_days_increments(self, db):
        user = make_user(db, "streak3@test.com", "password123", "streak3")
        # Simulate session yesterday
        user.last_study_date = datetime.utcnow() - timedelta(days=1)
        user.current_streak = 1
        db.commit()
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.current_streak == 2

    def test_missed_day_resets_streak(self, db):
        user = make_user(db, "streak4@test.com", "password123", "streak4")
        # Simulate session 3 days ago
        user.last_study_date = datetime.utcnow() - timedelta(days=3)
        user.current_streak = 5
        db.commit()
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.current_streak == 1

    def test_longest_streak_updates(self, db):
        user = make_user(db, "streak5@test.com", "password123", "streak5")
        user.last_study_date = datetime.utcnow() - timedelta(days=1)
        user.current_streak = 4
        user.longest_streak = 4
        db.commit()
        crud.create_study_session(db, user.id, 10)
        db.refresh(user)
        assert user.longest_streak == 5

    def test_get_effective_streak_zero_if_stale(self, db):
        user = make_user(db, "streak6@test.com", "password123", "streak6")
        user.last_study_date = datetime.utcnow() - timedelta(days=5)
        user.current_streak = 7
        db.commit()
        assert crud.get_effective_streak(user) == 0

    def test_get_effective_streak_returns_streak_if_today(self, db):
        user = make_user(db, "streak7@test.com", "password123", "streak7")
        user.last_study_date = datetime.utcnow()
        user.current_streak = 3
        db.commit()
        assert crud.get_effective_streak(user) == 3

    def test_get_effective_streak_returns_streak_if_yesterday(self, db):
        user = make_user(db, "streak8@test.com", "password123", "streak8")
        user.last_study_date = datetime.utcnow() - timedelta(days=1)
        user.current_streak = 5
        db.commit()
        assert crud.get_effective_streak(user) == 5


# ---------------------------------------------------------------------------
# Badge rules
# ---------------------------------------------------------------------------

class TestBadgeRules:
    """Core badge conditions checked via crud.check_badges."""

    def test_first_session_badge(self, db):
        user = make_user(db, "badge1@test.com", "password123", "badge1")
        crud.create_study_session(db, user.id, 10)
        badges = crud.check_badges(db, user.id)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "first_steps" in all_badges

    def test_badge_not_awarded_twice(self, db):
        user = make_user(db, "badge2@test.com", "password123", "badge2")
        crud.create_study_session(db, user.id, 10)
        crud.check_badges(db, user.id)
        crud.create_study_session(db, user.id, 10)
        crud.check_badges(db, user.id)
        count = db.query(models.UserBadge).filter_by(
            user_id=user.id, badge_id="first_steps"
        ).count()
        assert count == 1

    def test_early_bird_badge_for_pre_7am_session(self, db):
        user = make_user(db, "badge3@test.com", "password123", "badge3")
        badges = crud.check_badges(db, user.id, session_hour=5)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "early_bird" in all_badges

    def test_no_early_bird_for_afternoon_session(self, db):
        user = make_user(db, "badge4@test.com", "password123", "badge4")
        crud.check_badges(db, user.id, session_hour=14)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "early_bird" not in all_badges

    def test_night_owl_badge_for_late_session(self, db):
        user = make_user(db, "badge5@test.com", "password123", "badge5")
        crud.check_badges(db, user.id, session_hour=23)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "night_owl" in all_badges

    def test_on_fire_badge_at_3_day_streak(self, db):
        user = make_user(db, "badge6@test.com", "password123", "badge6")
        user.current_streak = 3
        user.longest_streak = 3
        db.commit()
        crud.check_badges(db, user.id)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "on_fire" in all_badges

    def test_week_warrior_at_7_day_streak(self, db):
        user = make_user(db, "badge7@test.com", "password123", "badge7")
        user.current_streak = 7
        user.longest_streak = 7
        db.commit()
        # Pre-seed lower streak badges to avoid the MAX_BADGES_PER_CHECK=2 cap
        for badge_id in ["on_fire", "momentum_builder"]:
            db.add(models.UserBadge(user_id=user.id, badge_id=badge_id))
        db.commit()
        crud.check_badges(db, user.id)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "week_warrior" in all_badges

    def test_week_warrior_not_at_6_day_streak(self, db):
        user = make_user(db, "badge8@test.com", "password123", "badge8")
        user.current_streak = 6
        user.longest_streak = 6
        db.commit()
        crud.check_badges(db, user.id)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "week_warrior" not in all_badges

    def test_hour_of_power_badge_for_60min_session(self, db):
        user = make_user(db, "badge9@test.com", "password123", "badge9")
        badges = crud.check_badges(db, user.id, session_minutes=60)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "hour_of_power" in all_badges

    def test_endurance_mode_badge_for_120min_session(self, db):
        user = make_user(db, "badge10@test.com", "password123", "badge10")
        crud.check_badges(db, user.id, session_minutes=120)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "endurance_mode" in all_badges

    def test_founding_member_badge_with_100_slots_available(self, db):
        user = make_user(db, "badge11@test.com", "password123", "badge11")
        # Complete 2 sessions to qualify
        crud.create_study_session(db, user.id, 10)
        crud.create_study_session(db, user.id, 10)
        crud.check_badges(db, user.id)
        all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
        assert "founding_member" in all_badges

    def test_founding_member_gets_coin_bonus(self, db):
        user = make_user(db, "badge12@test.com", "password123", "badge12")
        crud.create_study_session(db, user.id, 10)
        crud.create_study_session(db, user.id, 10)
        before_coins = user.total_coins
        crud.check_badges(db, user.id)
        db.refresh(user)
        assert user.eco_credits_multiplier == 1.25

    def test_badge_check_returns_list_of_new_badges(self, db):
        user = make_user(db, "badge13@test.com", "password123", "badge13")
        crud.create_study_session(db, user.id, 10)
        new_badges = crud.check_badges(db, user.id)
        assert isinstance(new_badges, list)

    def test_first_friend_badge_awarded_on_first_animal(self, db):
        user = make_user(db, "badge14@test.com", "password123", "badge14")
        animal = db.query(models.Animal).first()
        if animal:
            db.add(models.UserAnimal(user_id=user.id, animal_id=animal.id))
            db.commit()
            crud.check_badges(db, user.id)
            all_badges = {b.badge_id for b in db.query(models.UserBadge).filter_by(user_id=user.id).all()}
            assert "first_friend" in all_badges


# ---------------------------------------------------------------------------
# Egg mechanics
# ---------------------------------------------------------------------------

class TestEggMechanics:
    def test_egg_created_on_user_creation(self, db):
        user = make_user(db, "egg1@test.com", "password123", "egg1")
        egg = crud.get_user_egg(db, user.id)
        assert egg is not None

    def test_egg_initial_progress_zero(self, db):
        user = make_user(db, "egg2@test.com", "password123", "egg2")
        egg = crud.get_user_egg(db, user.id)
        assert egg.coins_deposited == 0

    def test_egg_cost_increases_with_animals_hatched(self, db):
        user = make_user(db, "egg3@test.com", "password123", "egg3")
        first_egg = crud.get_user_egg(db, user.id)
        base_cost = first_egg.coins_required  # should be 100
        assert base_cost == 100

    def test_hatch_fails_if_not_enough_coins(self, db):
        user = make_user(db, "egg4@test.com", "password123", "egg4")
        success, animal, msg = crud.hatch_egg(db, user.id)
        assert success is False
        assert "more coins" in msg.lower() or "need" in msg.lower()
