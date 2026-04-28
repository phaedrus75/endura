"""API tests for research consent + survey flow."""

from tests.conftest import admin_headers


def test_research_consent_and_submit_flow(client, alice, alice_headers):
    # Admin creates a survey with one question.
    create = client.post(
        "/admin/research/surveys",
        json={
            "survey_key": "study_habits_pulse_v1",
            "title": "Study habits pulse",
            "trigger_type": "manual",
            "questions": [
                {
                    "question_key": "motivation_today",
                    "prompt": "How motivated do you feel today?",
                    "question_type": "likert",
                    "options": ["1", "2", "3", "4", "5"],
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
    assert assign.status_code == 200
    assert assign.json()["assigned"] == 1

    # Until consent is true, /next asks for consent.
    nxt = client.get("/research/surveys/next", headers=alice_headers)
    assert nxt.status_code == 200
    assert nxt.json()["needs_consent"] is True

    consent = client.post("/research/consent", json={"consent": True}, headers=alice_headers)
    assert consent.status_code == 200
    assert consent.json()["consent"] is True

    nxt2 = client.get("/research/surveys/next", headers=alice_headers)
    assert nxt2.status_code == 200
    assert nxt2.json()["needs_consent"] is False
    assert nxt2.json()["assignment"] is not None
    assignment_id = nxt2.json()["assignment"]["id"]
    question_id = nxt2.json()["survey"]["questions"][0]["id"]

    start = client.post(f"/research/surveys/{assignment_id}/start", headers=alice_headers)
    assert start.status_code == 200
    assert start.json()["status"] == "started"

    submit = client.post(
        f"/research/surveys/{assignment_id}/submit",
        json={"answers": [{"question_id": question_id, "answer": "4"}]},
        headers=alice_headers,
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "submitted"

    nxt3 = client.get("/research/surveys/next", headers=alice_headers)
    assert nxt3.status_code == 200
    assert nxt3.json()["survey"] is None

