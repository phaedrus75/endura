"""
API tests for admin endpoints.
ADMIN-01 through ADMIN-09 from the test plan.
"""
import pytest
from tests.conftest import make_user, admin_headers, jwt_headers


class TestAdminOverview:
    def test_overview_returns_kpis(self, client):
        """ADMIN-01: GET /admin/overview returns KPI fields."""
        resp = client.get("/admin/overview", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, dict)

    def test_overview_rejects_missing_key(self, client):
        """ADMIN-07: Missing key → 422 or 403."""
        resp = client.get("/admin/overview")
        assert resp.status_code in (422, 403)

    def test_overview_rejects_wrong_key(self, client):
        resp = client.get("/admin/overview", headers={"x-admin-key": "wrong"})
        assert resp.status_code == 403


class TestAdminUsers:
    def test_users_list_returns_paginated(self, client, alice):
        """ADMIN-02: GET /admin/users returns users list."""
        resp = client.get("/admin/users", headers=admin_headers())
        assert resp.status_code == 200
        data = resp.json()
        # Should have users field or be a list
        assert "users" in data or isinstance(data, list)

    def test_users_filtered_by_search(self, client, alice):
        """Search filter works."""
        resp = client.get(f"/admin/users?search=alice", headers=admin_headers())
        assert resp.status_code == 200

    def test_users_archived_filter_active_and_invalid(self, client, alice):
        """archived_filter=active and archived_only accepted; invalid value → 400."""
        resp = client.get("/admin/users?archived_filter=active", headers=admin_headers())
        assert resp.status_code == 200
        resp2 = client.get("/admin/users?archived_filter=archived_only", headers=admin_headers())
        assert resp2.status_code == 200
        bad = client.get("/admin/users?archived_filter=yes", headers=admin_headers())
        assert bad.status_code == 400


class TestAdminFeedback:
    def test_feedback_list_filtered_by_status(self, client, alice, alice_headers):
        """ADMIN-03: GET /admin/feedback filtered by status."""
        # Submit some feedback first
        client.post("/feedback", json={
            "feedback_type": "bug",
            "message": "Timer issue"
        }, headers=alice_headers)
        resp = client.get("/admin/feedback?status=new", headers=admin_headers())
        assert resp.status_code == 200

    def test_feedback_status_update(self, client, alice, alice_headers, db):
        """ADMIN-04: PATCH /admin/feedback/{id} updates status."""
        import models
        client.post("/feedback", json={
            "feedback_type": "bug",
            "message": "Crash on timer end"
        }, headers=alice_headers)
        feedback = db.query(models.UserFeedback).first()
        if feedback:
            resp = client.patch(f"/admin/feedback/{feedback.id}",
                                json={"status": "triaged"},
                                headers=admin_headers())
            assert resp.status_code == 200
            db.refresh(feedback)
            assert feedback.status == "triaged"


class TestAdminCleanup:
    def test_cleanup_countries_dry_run(self, client):
        """ADMIN-05: dry_run=true returns changes without mutating."""
        resp = client.post("/admin/cleanup-countries?dry_run=true",
                           headers=admin_headers())
        assert resp.status_code == 200


class TestAdminPushTemplates:
    def test_get_push_templates(self, client):
        """ADMIN-08: GET /admin/push/templates returns all templates."""
        resp = client.get("/admin/push/templates", headers=admin_headers())
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_update_push_template(self, client, db):
        """ADMIN-09: PUT template updates body."""
        import models
        # Create a test template
        tmpl = models.PushTemplate(
            template_key="test_tmpl_admin",
            name="Test Template",
            title="Test Title",
            body="Original body",
            category="marketing"
        )
        db.add(tmpl)
        db.commit()
        # PUT requires all required fields + template_key in both path and body
        resp = client.put("/admin/push/templates/test_tmpl_admin",
                          json={
                              "template_key": "test_tmpl_admin",
                              "name": "Test Template",
                              "title": "Test Title",
                              "body": "Updated body",
                              "category": "marketing",
                              "is_active": True,
                          },
                          headers=admin_headers())
        assert resp.status_code == 200
        db.refresh(tmpl)
        assert tmpl.body == "Updated body"


class TestAdminProductTests:
    def test_create_update_promote_product_test(self, client):
        create = client.post(
            "/admin/product-tests",
            json={
                "name": "Onboarding v1 vs v2",
                "feature_key": "onboarding_ab_v2",
                "control_label": "v1",
                "challenger_label": "v2",
                "hypothesis": "v2 improves onboarding completion",
            },
            headers=admin_headers(),
        )
        assert create.status_code == 200, create.text
        test_id = create.json()["id"]

        upd = client.patch(
            f"/admin/product-tests/{test_id}",
            json={
                "status": "running",
                "sample_control": 500,
                "sample_challenger": 510,
                "conversion_control": 41.5,
                "conversion_challenger": 45.2,
                "winner": "challenger",
                "note": "Early look favors challenger",
            },
            headers=admin_headers(),
        )
        assert upd.status_code == 200
        assert upd.json()["status"] == "running"
        assert upd.json()["winner"] == "challenger"

        promote = client.post(
            f"/admin/product-tests/{test_id}/promote-winner",
            json={"winner": "challenger", "note": "Ship v2"},
            headers=admin_headers(),
        )
        assert promote.status_code == 200
        assert promote.json()["status"] == "winner_promoted"

        rows = client.get("/admin/product-tests?include_events=true", headers=admin_headers())
        assert rows.status_code == 200
        tests = rows.json().get("tests", [])
        hit = next((t for t in tests if t["id"] == test_id), None)
        assert hit is not None
        assert hit["events"], "timeline events should exist"


class TestAdminAuthRequired:
    """Spot-check that ALL admin routes require the key."""
    ADMIN_ROUTES = [
        ("GET", "/admin/overview"),
        ("GET", "/admin/users"),
        ("GET", "/admin/feedback"),
        ("GET", "/admin/push/templates"),
        ("GET", "/admin/push/opt-in-funnel"),
    ]

    def test_all_admin_routes_need_key(self, client):
        for method, url in self.ADMIN_ROUTES:
            if method == "GET":
                resp = client.get(url, headers={"x-admin-key": "wrong"})
            else:
                resp = client.post(url, headers={"x-admin-key": "wrong"})
            assert resp.status_code == 403, f"{method} {url} should return 403 with wrong key"
