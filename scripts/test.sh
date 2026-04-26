#!/usr/bin/env bash
# scripts/test.sh — Endura pre-push regression gate
# Run this before every build trigger or git push to main.
# Usage: ./scripts/test.sh [--fast]   (--fast skips frontend tests)

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
FAST="${1:-}"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     ENDURA REGRESSION TEST SUITE       ║"
echo "╚════════════════════════════════════════╝"
echo ""

PASS=0
FAIL=0
BACKEND_EXIT=0
FRONTEND_EXIT=0

# ────────────────────────────────────────
# 1. Backend (pytest)
# ────────────────────────────────────────
echo "▶ Running backend tests..."
echo "─────────────────────────────────────────"

cd "$BACKEND"

# Deactivate any currently active venv to start clean
deactivate 2>/dev/null || true

# Find python3 that has the full app stack (fastapi + pytest)
# Try system paths first; fall back to venv if venv has everything
_PY_CANDIDATES=(
  "/opt/homebrew/bin/python3"
  "/usr/local/bin/python3"
  "/usr/bin/python3"
  "python3"
)
PY=""
for _candidate in "${_PY_CANDIDATES[@]}"; do
  if $_candidate -c "import pytest, fastapi, sqlalchemy" 2>/dev/null; then
    PY="$_candidate"
    break
  fi
done

if [ -z "$PY" ]; then
  # Last resort: activate venv and hope for the best
  if [ -f "venv/bin/activate" ]; then source venv/bin/activate; fi
  if python3 -c "import pytest" 2>/dev/null; then PY="python3"; fi
fi

if [ -z "$PY" ]; then
  echo "ERROR: No Python with pytest+fastapi found."
  echo "  Run: pip install -r requirements.txt"
  exit 1
fi
echo "  Using: $PY ($($PY --version))"

# Set test env vars (override any Railway vars)
export DATABASE_URL="sqlite:///./test_endura.db"
export SECRET_KEY="test-secret-key-for-testing-must-be-32-chars"
export ADMIN_API_KEY="test-admin-key"
export RESEND_API_KEY="test-resend-key"
export EVERY_ORG_WEBHOOK_TOKEN="test-webhook-token"
export POSTHOG_PERSONAL_API_KEY="test-posthog-key"
export APPFIGURES_PAT="test-appfigures-key"
export SENTRY_DSN=""

if $PY -m pytest tests/ \
    --tb=short -q \
    --json-report --json-report-file=".test-results.json" \
    --timeout=120 \
    2>&1; then
  echo ""
  echo "✅ Backend tests PASSED"
  PASS=$((PASS + 1))
else
  BACKEND_EXIT=$?
  echo ""
  echo "❌ Backend tests FAILED (exit $BACKEND_EXIT)"
  FAIL=$((FAIL + 1))
fi

# Clean up test DB file
rm -f test_endura.db .test-results.json

# ────────────────────────────────────────
# 2. Frontend (Jest)
# ────────────────────────────────────────
if [ "$FAST" != "--fast" ]; then
  echo ""
  echo "▶ Running frontend tests..."
  echo "─────────────────────────────────────────"
  cd "$FRONTEND"

  if npx jest --passWithNoTests 2>&1; then
    echo ""
    echo "✅ Frontend tests PASSED"
    PASS=$((PASS + 1))
  else
    FRONTEND_EXIT=$?
    echo ""
    echo "❌ Frontend tests FAILED (exit $FRONTEND_EXIT)"
    FAIL=$((FAIL + 1))
  fi
fi

# ────────────────────────────────────────
# Summary
# ────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ ALL TESTS PASSED ($PASS suite(s))"
  echo "══════════════════════════════════════════"
  echo ""
  echo "  Safe to push / trigger build."
  echo ""
  exit 0
else
  echo "  ❌ $FAIL SUITE(S) FAILED — do not push!"
  echo "══════════════════════════════════════════"
  echo ""
  echo "  Fix the failures above, then re-run:"
  echo "    ./scripts/test.sh"
  echo ""
  exit 1
fi
