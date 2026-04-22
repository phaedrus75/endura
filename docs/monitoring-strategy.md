# Monitoring & Alerting Strategy

> **Status:** Phase 1 shipped 22 April 2026 (uptime + error tracking).
> Phase 2 (funnel alerts, digest, log aggregation) deferred until we
> feel pain from not having it or hit ~1,000 users.
> Last updated: 22 April 2026

---

## Why we have this document

On 4/20/2026 we noticed — two days late — that daily signups had dipped
to 21 vs a 35-40/day baseline. The only way we could tell *why* was by
ad-hoc SQL, because there was zero retained record of backend errors or
traffic, and no alerting. We don't want that to be the process going
forward.

This doc captures the tiered monitoring plan, what's shipped now, and
what we've explicitly deferred.

---

## The 4-layer model

Concentric rings — each layer catches a different class of failure:

| # | Layer | Answers | Tool |
|---|---|---|---|
| 1 | Infra / uptime | "Is the server reachable at all?" | BetterStack / UptimeRobot |
| 2 | Backend errors | "Are requests returning 500s?" | Sentry |
| 3 | Mobile crashes | "Is the app crashing for real users?" | Sentry |
| 4 | Product funnel | "Did signups / verifies / sessions drop?" | PostHog alerts |
| 5 | Business review (weekly, non-pager) | "Is growth trending the right way?" | Admin dashboard + weekly digest |

Most real outages fire in layer 1 or 2 within minutes. Layer 4 catches
subtle regressions (deploy broke signup for Android 14 only). Layer 5
catches strategic drift (4/20-style dips).

---

## Where we stand today (~300 users)

| Layer | Status | Notes |
|---|---|---|
| 1 — Uptime monitor | ⏸ Set up pending (needs 5-min account sign-up on BetterStack) | `/health` endpoint live and returns 503 if DB is down |
| 2 — Sentry (backend) | ✅ Shipped 22/04/26 — awaits `SENTRY_DSN` in Railway | FastAPI auto-instrumentation; tags env + git SHA |
| 3 — Sentry (mobile) | ✅ Shipped 22/04/26 — awaits DSN in `app.json extra.sentryDsn` | `@sentry/react-native` 8.8.x, Expo config plugin |
| 4 — PostHog alerts | ⏸ Deferred | Can enable via PostHog UI (no code change) |
| 5 — Weekly digest | ⏸ Deferred | APScheduler job is a simple add when we want it |
| Log aggregation (L2b) | ⏸ Deferred | Railway's built-in (~7-day retention) is enough for now |

---

## Key metrics and thresholds

### Layer 1 — uptime & infra

| Metric | Alert threshold | Severity |
|---|---|---|
| `GET /health` non-200 | 2 consecutive 30s checks fail | P1 |
| SSL cert expiry (`endura.app`) | 14 days out | P2 |
| Railway deploy failed | any | P1 (immediate) |
| DB connection pool | > 80% saturated for 5 min | P2 |

### Layer 2 — backend errors (Sentry)

| Metric | Alert threshold | Severity |
|---|---|---|
| 5xx error rate | > 1% of requests in a 5-min window | P1 |
| Unhandled exception rate per route | > 5 in 10 min on any single endpoint | P2 |
| p95 latency on `/auth/login`, `/auth/register`, `/sessions/*`, `/auth/me` | > 2s for 5 min | P2 |
| APScheduler cron failure | any job throws 2 runs in a row | P2 |
| Alembic migration failed on deploy | any | P1 |

### Layer 3 — mobile (Sentry)

| Metric | Alert threshold | Severity |
|---|---|---|
| Crash-free session rate | < 99% on latest app version | P2 |
| New exception signature | new, on > 5 users, in < 24h | P2 |
| Regression: old exception re-appears after being marked resolved | any | P2 |

### Layer 4 — product funnel (PostHog, deferred)

| Metric | Alert threshold | Severity |
|---|---|---|
| Signups/hour vs 7-day rolling median | < 20% for 3 consecutive hours | P2 (this is the 4/20 catcher) |
| Verify-email success rate | < 60% for 1 hour | P2 |
| First-session completion rate | drops 30% WoW | P3 (weekly review) |
| DAU | drops 20% WoW | P3 |

### Layer 5 — weekly digest (deferred)

Not pager-worthy, but emailed Monday morning:

- WoW change in signups, DAU, total minutes studied
- Retention D1 / D7 / D30 by weekly cohort
- Top 5 countries by signups (spots "India flat 3 weeks" trends)
- Top 3 Sentry issue groups by event count
- Any failed crons in the last 7 days
- Mobile crash-free rate by app version

---

## Alert routing

Three severities, three channels — keep P1 actually pageable:

| Severity | Channel | Examples |
|---|---|---|
| **P1 — wake me up** | SMS + Slack `#alerts-p1` | API down 2+ min, 5xx > 5%, DB unreachable |
| **P2 — check within the hour** | Slack `#alerts` | Signups < 20% of median for 3h, verify rate < 60%, new mobile crash on > 5 users |
| **P3 — Monday digest** | Email | WoW drops, retention changes, non-critical cron miss |

Without this tiering, alerts become noise and get muted within a week.

---

## Tool choices and why

| Tool | Cost at our scale | Alternative we ruled out | Why |
|---|---|---|---|
| **Sentry** (errors + crashes) | Free tier: 5k errors, 10k perf events / mo | Datadog, Rollbar, Bugsnag | Datadog is enterprise-priced ($15/host + usage); Sentry free tier genuinely covers us until ~10k MAU |
| **BetterStack Uptime** | Free: 10 monitors, 3-min interval | UptimeRobot, Pingdom | Cleanest free tier UX; native Slack + SMS; upgrade path is linear |
| **PostHog alerts** | Included in PostHog free tier | Amplitude | We already use PostHog; zero extra cost or cognitive load |
| **Railway logs** (L2b, short-term) | Free, ~7-day retention | BetterStack Logs, Logtail | Good enough at 300 users; revisit when an incident needs 30+ day history |
| **Slack free tier** | Free | Discord, PagerDuty | One `#alerts` channel is fine; add PagerDuty only when we have on-call rotation |

**Total net-new cost at current scale: $0/mo.** Everything scales to
roughly $25–50/mo at 10k users.

---

## Phase 1 — what was shipped 22 April 2026

1. **`GET /health`** — deep health check with DB connectivity + latency.
   Returns `503` if the DB is unreachable. Safe for external uptime
   monitors to ping every 30s. Railway's own deploy healthcheck still
   points at `/` (shallow) to avoid spurious rollbacks during DB blips.
2. **Sentry backend SDK** — `sentry-sdk[fastapi]` 2.58.0 in
   `backend/requirements.txt`. Initialised at top of `main.py` before
   FastAPI instantiation so Starlette/FastAPI routes auto-instrument.
   Tags every event with `environment` (from `RAILWAY_ENVIRONMENT`)
   and `release` (from `RAILWAY_GIT_COMMIT_SHA`). `send_default_pii=False`.
   No-op when `SENTRY_DSN` isn't set, so local dev is unaffected.
3. **Sentry mobile SDK** — `@sentry/react-native` 8.8.x in
   `frontend/package.json`; Expo config plugin wired in `app.json`.
   `services/monitoring.ts` encapsulates `init()`, identify/reset on
   login/logout, and a `captureError()` helper. `App` default export
   wrapped with `Sentry.wrap()` for native crash + ErrorBoundary support.
   Disabled in `__DEV__` so hot-reload errors don't pollute the dashboard.

### What you still need to do once (≈ 15 min)

1. Create a free Sentry account → create 2 projects: `endura-api`
   (Python FastAPI) and `endura-mobile` (React Native).
2. Paste the Python DSN into Railway as env var `SENTRY_DSN`.
   Redeploy — the init log will print `✅ Sentry initialised`.
3. Paste the React Native DSN into `frontend/app.json` under
   `expo.extra.sentryDsn`, run `npx expo install`, and rebuild the app
   with EAS.
4. Add `SENTRY_AUTH_TOKEN` to your shell / EAS secrets to enable
   source-map upload on mobile builds. (Sentry docs give you this token
   when you set up the org; it's not committed anywhere.)
5. Sign up for BetterStack Uptime (free), add a monitor on
   `https://web-production-34028.up.railway.app/health` every 30s,
   alert after 2 consecutive failures. Slack webhook delivery.
6. Test it end-to-end: hit any broken endpoint once, confirm it shows up
   in Sentry within ~30s with a full stack trace and git SHA.

---

## Phase 2 — deferred, build when triggered

**Triggers** (any one):
- DAU crosses ~1,000
- We ship a paid feature (subscriptions, in-app donations we remit)
- A P2-worthy incident slips through because we didn't notice for > 24 hours
- Railway free log retention (7d) bites us during a postmortem

**Work items at that point:**
- **2A — PostHog funnel alerts:** configure via PostHog UI (no code):
  "signups/hour < 20% of 7-day rolling median for 3h" → Slack
- **2B — Weekly digest email:** new APScheduler job at 09:00 local on
  Mondays. Emails admin with WoW metrics and top Sentry issues. ~2h work.
- **2C — Durable log aggregation:** forward Railway logs to BetterStack
  Logs or similar ($25/mo at our scale). Enables 30-day searchable
  history for post-incident forensics.
- **2D — Crash-free session SLO panel:** add Sentry metrics to the
  admin dashboard (we already have `adminFetch`; Sentry has a simple
  REST API).

---

## Phase 3 — far-future, probably never at indie scale

Listed only so we don't accidentally over-engineer earlier:

- ❌ Distributed tracing across services (we have one service)
- ❌ APM with span sampling budgets (Sentry's free perf covers us)
- ❌ PagerDuty + on-call rotation (single-developer shop)
- ❌ Anomaly detection ML on retention curves (naive % thresholds are fine)
- ❌ Datadog / New Relic (priced for companies 100x bigger)
- ❌ Self-hosted Grafana / Prometheus stack (maintenance cost > benefit)

---

## Why Sentry and not Datadog (for the record)

Asked on 22/04/26 before shipping Phase 1. Decision:

|  | Sentry | Datadog |
|---|---|---|
| Focus | Error tracking + crash reports | Full-stack observability |
| Free tier | 5k errors + 10k perf / mo, usable forever | 14-day trial, then ~$15/host/mo + log/APM add-ons |
| FastAPI + Expo SDKs | First-class, 3-line setup | Works, but needs agent + infra config |
| Sweet spot | Indie → mid-size: "something broke, tell me what" | Enterprise: "trace 1 request across 12 services" |
| Migration cost | Easy to leave later | Easy to leave later but expensive to scale down |

At 300 users with one backend service, Sentry covers 95%+ of what we
need. We can stand up Datadog alongside Sentry later if we ever hit the
"many services, need distributed traces" problem — most teams that end
up on both started with Sentry.

---

## Runbook — what to do when an alert fires

1. **P1 fires** (API down or 5xx spike)
   - Open Sentry → sort by "most users affected" → read the top issue.
   - If stack trace points at a specific endpoint, check Railway logs
     live (`railway logs --service web`) and the last 2 commits.
   - If no Sentry event fired but uptime is red, check Railway
     deployment status — likely a bad deploy that failed healthcheck.
   - Roll back via `railway redeploy` on the previous deployment.

2. **P2 fires** (funnel or individual-route regression)
   - Was there a deploy in the last 24h? `git log --since=1day`
   - If yes: Sentry → filter by `release` → compare before/after.
   - If no: PostHog funnel → break down by country / OS / app version
     to see if it's concentrated somewhere (like the 4/20 pattern).

3. **P3 fires** (weekly digest flags something)
   - Open admin dashboard → Overview tab → Weekly granularity.
   - Cross-reference Sentry issue trends with the same time window.
   - Add the finding to the roadmap if it's not a one-off.
