# Onboarding A/B test — results

**Snapshot:** 4 May 2026 ~10:00 UTC (≈12 h after 1.0.5 hit the App Store).
**Decision:** v2 wins, hardcoded in 1.0.5; A/B assignment code retained for future tests.
**Source:** `users` + `study_sessions` on Railway Postgres. SQL at the bottom of this file.

> Companion canvas: `~/.cursor/projects/Users-munshi-Downloads-endura-v-2/canvases/onboarding-ab-test-waterfall.canvas.tsx` — open it beside the chat for the interactive view.

---

## Cohort definitions

| Cohort | Window | Flow | Maturity | n |
|---|---|---|---|---:|
| **old** | Apr 17 – Apr 30 | App Store v1.0.3 — walkthrough after auth, no A/B code | 14+ days observed (fully matured) | 688 |
| **v1_ab** | May 1 – May 3 | A/B `v1` arm — skip walkthrough | 1–3 days observed | 128 |
| **v2_ab** | May 1 – May 3 | A/B `v2` arm — walkthrough before auth | 1–3 days observed | 119 |
| **post_launch** | May 3 22:00 UTC + | 1.0.5 on App Store, **v2 hardcoded** for everyone | 0–12 hours observed (in flight) | 31 |

The Apr 15–16 launch days are deliberately excluded — they were a different acquisition cohort dominated by the founder-circle push.

---

## Headline results

**v2 nearly doubles 72-hour activation vs the pre-A/B flow, and the gap is now safely significant.**

| Metric | old | v1_ab | v2_ab | post_launch |
|---|---:|---:|---:|---:|
| Signups | 688 | 128 | 119 | 31 |
| Set username | 77.8% | 95.3% | **97.5%** | 90.3% |
| Onboarding complete | n/a † | 94.5% | **95.0%** | 87.1% |
| Started ≥1 session | 42.2% | 53.1% | **62.2%** | 54.8% |
| Completed 3+ in 72 h | 16.9% | 20.3% | **30.3%** | 9.7% ⏱ |

† `/user/onboarding/complete` shipped in the May 1 build alongside the A/B test, so old has no instrumentation here.
⏱ post_launch's 72 h activation rate is observation-truncated — none of these 31 users has had 72 h yet. Treat the 9.7% figure as noise.

---

## Statistical signal

Two-proportion z-tests, two-tailed.

| Comparison | Δ (pts) | Δ (relative) | p-value | Verdict | vs 3 May |
|---|---:|---:|---:|---|---|
| v2_ab vs old — 3+ in 72 h | +13.4 | +79% | **p < 0.001** | very strong | strengthened from p<0.005 (n grew 32%) |
| v2_ab vs v1_ab — 3+ in 72 h | +9.9 | +49% | p ≈ 0.07 | marginal | unchanged — Δ shrank slightly |
| v2_ab vs v1_ab — username → 1+ session | +8.1 | +15% | p ≈ 0.20 | no signal | gap closing as v1 sample matures |
| v1_ab vs old — 3+ in 72 h | +3.4 | +20% | p ≈ 0.35 | no signal | unchanged — v1 ≈ old at activation |

**Why we shipped v2 anyway despite v2-vs-v1 being only marginal:** the directional lift is unanimous at every funnel stage, and the cost of waiting for `p<0.05` (running a worse flow against every new App Store signup) is larger than the cost of a wrong call. v2-vs-old is the comparison that actually matters since old is no longer in market.

---

## Step-to-step retention (where v2 wins)

| Transition | old | v1_ab | v2_ab | post_launch | Winner |
|---|---:|---:|---:|---:|:---:|
| Signup → Set username | 77.8% | 95.3% | **97.5%** | 90.3% | v2_ab |
| Username → Started 1+ session | 54.2% | 55.7% | **63.8%** | 60.7% | v2_ab |
| Started → Completed 3+ in 72 h | 40.0% | 38.2% | **48.6%** | n/a (in flight) | v2_ab |
| Signup → Completed 3+ in 72 h | 16.9% | 20.3% | **30.3%** | n/a (in flight) | v2_ab |

Best apples-to-apples step is **Username → Started 1+ session** (skips the uninstrumented stage 3 for old). v2 wins by +9.6 pts vs old, +8.1 pts vs v1.

---

## Why v2 works

1. **Higher username completion (97.5% vs old's 77.8%).** Showing the value prop (animals, focus, planet) before the email/password gate keeps intent intact through signup — fewer "what is this app?" bounces during the auth step.
2. **Better timer-screen activation (63.8% vs old's 54.2% of username-setters).** Pre-primed users land on the home screen already understanding what the app does.
3. **Stickier first 72 h (48.6% completed 3+ vs old's 40.0% of starters).** Users who tried the timer come back because the experience matches what they signed up for.

---

## Post-launch monitor (what to watch over the next 72 h)

The 31 post_launch signups already match v2_ab on the comparable early steps — small drops are expected because App Store traffic is less self-selected than TestFlight:

- **Username** 90.3% vs v2_ab 97.5% → 7 pt drop
- **Onboarding complete** 87.1% vs v2_ab 95.0% → 8 pt drop
- **Started 1+ session** 54.8% vs v2_ab 62.2% → 7 pt drop

Re-run this snapshot on **7 May ~10:00 UTC** when the first wave of post-launch signups will have a full 72 h window — that's the real read.

**Watch threshold for activation (3+ in 72 h):**
- Lands at **25%+** → call it done, App Store flow performs as well as TestFlight
- Lands between **22% and 25%** → mild acquisition-mix shift, acceptable
- Lands **below 22%** (halfway between v1 and v2) → App Store traffic is materially harder to activate; investigate before iterating further

---

## Caveats

1. **post_launch observation window.** The 31 signups since 3 May 22:00 UTC have had at most 12 h to complete 3+ sessions — none has hit 72 h yet. Username and 1+ session rates (90.3% / 54.8%) are the only meaningful early signals.
2. **Onboarding-complete instrumentation.** `old` shows 0 because `/user/onboarding/complete` shipped in the May 1 build alongside the A/B test. Stage 3 is meaningful for v1_ab / v2_ab / post_launch only.
3. **v1_ab and v2_ab are still maturing too.** Some users that signed up on May 2–3 still have hours left in their 72 h window — activation rates will tick up another 1–2 pts each over the next 48 h.
4. **Acquisition-mix shift.** TestFlight users (v1_ab/v2_ab) are self-selected; App Store users (post_launch) are not. Expect 5–10% lower activation across the board on post_launch even with the same flow — that's the new baseline.

---

## How to reproduce

Run on Railway Postgres (`railway run psql $DATABASE_URL`):

```sql
WITH cohorts AS (
  SELECT id, created_at,
    CASE
      WHEN created_at >= '2026-05-03 22:00:00'                        THEN 'post_launch'  -- v2 hardcoded
      WHEN created_at >= '2026-05-01' AND onboarding_ab_variant='v2'  THEN 'v2_ab'
      WHEN created_at >= '2026-05-01' AND onboarding_ab_variant='v1'  THEN 'v1_ab'
      WHEN created_at >= '2026-04-17' AND created_at < '2026-05-01'   THEN 'old'
    END AS cohort
  FROM users
  WHERE is_archived = false
),
sessions AS (
  SELECT user_id,
         COUNT(*) AS n_total,
         COUNT(*) FILTER (WHERE started_at <= (
           SELECT created_at FROM users WHERE users.id = study_sessions.user_id) + interval '72 hours'
         ) AS n_72h
  FROM study_sessions
  GROUP BY user_id
)
SELECT
  c.cohort,
  COUNT(*) FILTER (WHERE c.cohort IS NOT NULL)                          AS signups,
  COUNT(*) FILTER (WHERE u.username IS NOT NULL)                        AS set_username,
  COUNT(*) FILTER (WHERE u.onboarding_completed_at IS NOT NULL)         AS onboarding_complete,
  COUNT(*) FILTER (WHERE s.n_total >= 1)                                AS one_plus_session,
  COUNT(*) FILTER (WHERE s.n_72h >= 3)                                  AS three_plus_72h
FROM cohorts c
JOIN users u ON u.id = c.id
LEFT JOIN sessions s ON s.user_id = c.id
WHERE c.cohort IS NOT NULL
GROUP BY c.cohort
ORDER BY c.cohort;
```

Latest result (4 May 2026 ~10:00 UTC):

```
   cohort    | signups | set_username | onboarding_complete | one_plus_session | three_plus_72h
-------------+---------+--------------+---------------------+------------------+----------------
 old         |     688 |          535 |                   0 |              290 |            116
 post_launch |      31 |           28 |                  27 |               17 |              3
 v1_ab       |     128 |          122 |                 121 |               68 |             26
 v2_ab       |     119 |          116 |                 113 |               74 |             36
```
