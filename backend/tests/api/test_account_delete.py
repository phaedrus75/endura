"""DELETE /auth/account — hard delete must clear all FKs to users."""
import models
from tests.conftest import admin_headers, jwt_headers, make_user


def test_delete_account_with_research_assignment(client, alice, alice_headers, db):
    """Regression: research_survey_assignments FK blocked user delete (IntegrityError)."""
    create = client.post(
        "/admin/research/surveys",
        json={
            "survey_key": "acct_del_survey_v1",
            "title": "Acct del test",
            "trigger_type": "manual",
            "questions": [
                {
                    "question_key": "q1",
                    "prompt": "One?",
                    "question_type": "likert",
                    "options": ["1", "2"],
                    "is_required": True,
                    "sort_order": 1,
                }
            ],
        },
        headers=admin_headers(),
    )
    assert create.status_code == 200, create.text
    survey_id = create.json()["id"]

    assign = client.post(
        f"/admin/research/surveys/{survey_id}/assign",
        json={"user_ids": [alice.id], "consented_only": False, "trigger_reason": "test"},
        headers=admin_headers(),
    )
    assert assign.status_code == 200, assign.text

    alice_id = alice.id
    assert (
        db.query(models.ResearchSurveyAssignment)
        .filter(models.ResearchSurveyAssignment.user_id == alice_id)
        .count()
        == 1
    )

    resp = client.delete("/auth/account", headers=alice_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json().get("message")

    assert db.query(models.User).filter(models.User.id == alice_id).first() is None
    assert (
        db.query(models.ResearchSurveyAssignment)
        .filter(models.ResearchSurveyAssignment.user_id == alice_id)
        .count()
        == 0
    )


def test_delete_account_basic(client, db):
    """Smoke: new user with no research rows deletes cleanly."""
    u = make_user(db, email="deleter99@e.test", password="pw123456", username="deleter99")
    uid = u.id
    headers = jwt_headers(u.email)
    resp = client.delete("/auth/account", headers=headers)
    assert resp.status_code == 200, resp.text
    assert db.query(models.User).filter(models.User.id == uid).first() is None
