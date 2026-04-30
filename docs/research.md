# Endura — research brainstorming

This document collects **academic and product-adjacent research directions** that fit Endura’s in-app **survey / research** capability: opt-in consent, survey definitions (Likert, single/multi choice, number, free text), assignment lifecycle (assigned → shown → started → submitted / snoozed / dismissed), triggers (e.g. post-onboarding, periodic), cooldowns, and **joining responses to behavioural logs** (study minutes, sessions, streaks, tenure, geography, social graph, etc.).

**Current scale (snapshot):** ~620 users, **73 countries** — many questions become statistically stronger at **thousands** of users; some designs (waves, pooled regions) work even at modest N.

---

## How the product supports research (grounding)

- **Cross-sectional:** one-shot surveys after signup or on manual assign.
- **Longitudinal:** repeated surveys via `trigger_days_after_signup` or periodic triggers + cooldowns.
- **Selection bias work:** consent opt-in, snooze, dismiss, and partial completion are all measurable against behaviour.
- **Multilevel / geographic:** country or region as grouping variable once cells are large enough (aggregate sparse countries).
- **Mechanistic hints:** self-report + logs → mediation-style stories (e.g. motivation → sessions → minutes), with appropriate humility about causality.

---

## Cluster A — Original brainstorming (from internal discussion)

### A1. Self-regulated learning (SRL) across cultures

**Question:** Do self-reported planning, monitoring, and effort regulation relate to **objective** study patterns (session frequency, duration, consistency) the same way in different cultural or national contexts?

**Why it matters:** Learning science often over-indexes on WEIRD samples; your geography is a differentiator.

**Design notes:** Short validated-style Likert blocks (even if not full BRS/ECLS scales at first); join to pre-survey window logs (e.g. last 14 days).

---

### A2. “Study guilt” vs healthy persistence (streaks)

**Question:** Where do **streak-focused** behaviours correlate with **stress / burnout** self-reports vs with **sustained engagement**? Does that differ by country or segment?

**Design notes:** Pair streak metrics with 2–4 well-scoped affect items; pre-register hypotheses to avoid fishing.

---

### A3. School-assigned vs self-driven study

**Question:** What fraction of logged study is perceived as **school-assigned** vs **self-chosen**, and does that ratio predict retention and self-reported well-being?

**Why it matters:** Bridges informal learning, homework policy, and edtech positioning.

---

### A4. Intrinsic vs extrinsic motivation and trajectories

**Question:** Do users who report studying mainly for **grades / external pressure** show different **usage trajectories** (sessions, minutes, return after gaps) than those reporting **interest / mastery**?

---

### A5. Procrastination and implementation intentions

**Question:** Does a brief procrastination scale + a **concrete if–then plan** (e.g. preferred study window) predict who benefits from reminders or lifecycle messaging?

**Design notes:** Good fit for **post-onboarding** then a **follow-up wave** at day 30.

---

### A6. Social comparison and the friends graph

**Question:** Among users with in-app friends, does **perceived competitiveness** correlate with more study time, or with **higher friction** (notification snoozes, survey dismissals, lower subjective control)?

---

### A7. Streaks as a double-edged sword

**Question:** When do streaks support **habit formation** vs correlate with **anxiety** or **“broken streak” dropout**?

**Design notes:** Combine streak breaks in logs with a tiny “how did you feel when a streak ended?” module (careful wording; optional).

---

### A8. Collectibles, completion, and motives

**Question:** Do users who report **collection / completion** motives show different engagement curves than **competition** or **routine** motives?

---

### A9. Consent, completion, and non-response bias

**Question:** Who opts in to research? Who starts but never submits? Who snoozes? How does that bias **estimates** of stress, sleep, or study hours when merged with logs?

**Why it matters:** Publishable **methods** contribution for in-app research in consumer edtech.

---

### A10. Ecological validity of self-reported study time

**Question:** How well do **self-reported** weekly hours track **logged** minutes, and does miscalibration differ by country, age band, or study level?

---

## Cluster B — Additional directions (≈2× expansion)

### B1. Circadian preferences and “study when”

**Question:** Are self-reported chronotype / peak focus windows aligned with **actual** session start times in logs? Do mismatches predict burnout or lower retention?

---

### B2. Sleep quantity/quality vs next-day study

**Question:** Do short sleep surveys (e.g. PSQI-lite) correlate with **next-week** session counts or timer completion rates?

**Design notes:** Weekly or biweekly micro-surveys; watch redundancy with other apps’ sleep tracking.

---

### B3. Digital distractions and phone use during study

**Question:** Self-reported distraction (notifications, social apps) vs **session length distribution** — do “high distraction” users show more fragmented sessions?

---

### B4. Exam seasons and stress spikes

**Question:** Can users self-identify “high-stakes exam period” and does that align with **bursts** in logged minutes? Country differences in exam culture?

---

### B5. Eco-anxiety, climate concern, and engagement

**Question:** For a product with environmental framing: do **climate concern** or **eco-efficacy** items correlate with donation/charity features usage, shop choices, or overall retention?

---

### B6. AI study tools and academic integrity

**Question:** How often do users report using **AI assistants** for studying, and does that correlate with subject mix, session length, or self-reported understanding (honesty framing)?

**Why it matters:** Fast-moving policy topic; your panel spans many education systems.

---

### B7. Music, silence, and environment

**Question:** Study environment (library vs bedroom vs commute) and **audio strategy** — any link to session completion or self-rated focus?

---

### B8. Solo vs group study (real-world, not only app groups)

**Question:** Self-reported preference for solo vs group study vs actual use of **social/group** features — who is “underserved”?

---

### B9. Teacher / school endorsement

**Question:** Did a **teacher or school** recommend the app, and does that change early retention or reported usefulness?

**Design notes:** Single high-signal multiple-choice; powerful covariate for school-based rollouts later.

---

### B10. Parental pressure by region

**Question:** Parental expectations items vs **weekend vs weekday** study distribution — cultural moderation?

**Caution:** Sensitive; minimal items; clear ethics copy.

---

### B11. International students / multilingual learners

**Question:** Users studying in a **non-native language** — does language confidence moderate the relationship between self-reported difficulty and logged persistence?

---

### B12. Accessibility and disability (broad, optional)

**Question:** Optional disclosure: do users with **focus-related** or **visual** access needs use sessions differently, and do standard reminders feel helpful or harmful?

**Caution:** Privacy, stigma, small cells — aggregate and optional only.

---

### B13. ADHD-like attention patterns (screening-adjacent, not diagnostic)

**Question:** Very short **attention challenge** self-items (not clinical diagnosis) vs fragmented session patterns — useful for **product** inclusivity, not medical claims.

**Caution:** Never present as diagnosis; IRB/consultation if published.

---

### B14. Burnout inventory (ultra-short form)

**Question:** 3–5 emotional exhaustion / efficacy items vs churn in the following month — does a “burnout warning” pattern exist in logs?

---

### B15. Goal specificity (SMART vs vague goals)

**Question:** Users prompted to state a **specific weekly goal** — does specificity predict achievement vs self-reported satisfaction?

---

### B16. Leaderboards: pride vs pressure

**Question:** Self-reported attitude toward rankings vs engagement with **leaderboard** surfaces (if instrumented) or global vs friends leaderboard choice.

---

### B17. Notification load and control

**Question:** Perceived **notification overload** vs actual opt-outs / category toggles / push token loss — where is the product crossing the line?

---

### B18. Price sensitivity, premium, and fairness

**Question:** Willingness to pay / perceived fairness of monetisation vs country GDP proxy — informs **ethical pricing** papers (business + normative).

---

### B19. Subject mix: STEM vs humanities skew

**Question:** Self-reported primary subject area vs **session timing** and **streak** behaviour — STEM cramming vs humanities distributed practice stereotypes?

---

### B20. Migration stress / distance from home (optional)

**Question:** For users who indicate living **away from family** for study: loneliness items vs social feature use — exploratory cross-cultural.

**Caution:** Sensitive; optional; aggregate regions.

---

### B21. Habit stacking: pairing study with cues

**Question:** Users who report a **fixed cue** (“after dinner”, “after walk”) — do they show lower variance in session start time in logs?

---

### B22. “Deep work” vs many short sessions

**Question:** Self-rated preference for long deep blocks vs short sprints — match against **session length histogram** from data.

---

### B23. Cheating the timer vs integrity

**Question:** Anonymous honesty: “how often do you let the timer run without studying?” — relationship to self-concept and later retention (delicate wording).

**Caution:** Social desirability bias; interpret carefully.

---

### B24. Friend invites and prosocial motivation

**Question:** Users who report **helping friends study** as a motive — do they invite more friends, create groups, or sustain longer use?

---

### B25. Seasonal affect / latitude proxy (exploratory)

**Question:** Rough hemisphere or daylight season vs reported mood and study minutes — weak but fun exploratory at larger N.

---

### B26. Trust in data use and research participation

**Question:** Trust in how study data is used — does it predict **consent**, completion, or honesty on sensitive items?

---

### B27. Onboarding comprehension

**Question:** Short quiz on what the app **measures** (timer, streak) — does comprehension predict fewer support tickets / better retention?

---

### B28. Micro-randomised UX / copy (methods)

**Question:** If you ever A/B test in-app messages: does framing study as **“investment in future self”** vs **“don’t break the chain”** change snooze rates and next-week minutes?

**Note:** Overlaps product experimentation; pre-register.

---

### B29. Cultural tightness / rules (proxy via short scale)

**Question:** Short items on rule-following / discomfort with ambiguity vs response to **strict** streak mechanics vs **forgiving** mechanics (if product variants exist).

---

### B30. Language of app UI vs country

**Question:** Mismatch between **preferred language** and default UI language — friction vs engagement?

---

## Cluster C — Meta, ethics, and execution checklist

- **Pre-registration:** Pick 3–5 primary hypotheses before analysing waves 2–3.
- **Minimum N per cell:** Pool countries into regions until cells are stable; publish sensitivity analyses.
- **Waves:** Same construct at day 7 / 30 / 90 supports growth models without huge baseline N.
- **IRB / ethics:** Any publication-grade health, disability, or minors-adjacent work needs proper review and age gating.
- **Data minimisation:** Collect only what you need for each study; document retention.
- **Transparency:** Publish a short “research programme” page for users (what you learn, aggregate only).

---

## Suggested next step (operational)

1. Pick **one pillar** (e.g. cross-national SRL **or** streaks & well-being **or** consent bias).  
2. Design **one** 2-minute survey + **one** follow-up wave.  
3. Freeze **analysis plan** and **log join window** (e.g. −14d to +30d relative to submit).

---

*Document generated for internal planning; extend or prune as the panel grows.*
