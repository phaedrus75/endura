# Backup Strategy — revisit at 1,000 users

> **Status:** deferred. Revisit when DAU crosses ~1,000 users or before any
> paid-feature rollout that increases financial liability (subscriptions,
> donation splits that we remit rather than pass through Stripe, etc.).
> Last updated: 19 April 2026

---

## Where we stand today (~300 users)

| Layer | Status | Covers |
|---|---|---|
| **1. Railway native backups (Pro)** | ✅ Enabled | Accidental drops, bad migrations, in-Railway corruption; point-in-time restore within 7 days |
| **2. Offsite redundancy (encrypted dump to R2/S3)** | ⏸ Deferred | Railway account compromise, platform outage, subpoena scenarios, ransomware |
| **3. Manual on-demand dump** | ⏸ Deferred | Pre-migration safety snapshots |

Railway Pro alone covers ~95% of realistic risks at our scale. Offsite redundancy is pure insurance against a small set of low-probability, high-impact events.

---

## Trigger: when to actually build Layer 2 + 3

Build it when **any one** of these is true:

- [ ] **1,000+ users** in DB (PII blast radius starts to matter under GDPR)
- [ ] **Paid subscriptions / in-app purchases** launched (financial records need redundancy)
- [ ] **We start storing data we couldn't re-derive** (user-generated content: photos, longer journal entries, in-app messages we don't want to lose)
- [ ] **A scare** — any incident (accidental data loss, Railway outage, disputed chargeback) that makes us realise we can't afford the plaintext exposure

If none of those have happened by **Build 20** (or equivalent milestone), re-evaluate anyway.

---

## The plan (when we come back to build it)

### Architecture

```
Railway Postgres
       │
       ▼
  pg_dump | gzip
       │
       ▼
  age -r $BACKUP_PUBLIC_KEY     ← encrypt client-side
       │
       ▼
  .sql.gz.age  (encrypted, useless without private key)
       │
       ├──► Cloudflare R2 bucket (primary offsite)
       │      - Object Lock: 30-day compliance mode (ransomware-proof)
       │      - Versioning: on
       │
       └──► Manual admin endpoint (Layer 3): streams encrypted blob on demand
```

**Key principle:** no plaintext DB content ever leaves Railway. R2/S3/GitHub become interchangeable storage backends because the file is unreadable without the key.

### Why Cloudflare R2 (for Layer 2)

- **$0 egress fees** — means restoring the backup doesn't cost us money (matters if dumps grow to GB scale)
- **10 GB free tier** — fits us for years
- **S3-compatible** — can swap to AWS S3 later without code changes
- **Object Lock** — once uploaded, the blob cannot be deleted or overwritten for the retention window. Protects against rogue admin / ransomware.
- **Smaller blast radius than GitHub** — R2 tokens are scoped to one bucket; GitHub PATs typically have broad `repo` scope.

### Why age (for encryption)

- Simple — single command, no GPG config.
- Modern crypto (X25519 + ChaCha20-Poly1305).
- Public-key model: the server only needs the **public** key to encrypt. Private key never touches Railway. Any attacker who owns Railway still can't read the dumps.

---

## Work items (when unlocked)

### Phase 2A — offsite encrypted backups

- [ ] Create Cloudflare R2 bucket `endura-backups`
- [ ] Enable bucket versioning + 30-day Object Lock (compliance mode)
- [ ] Generate API token scoped to the bucket (`PutObject`, `ListBucket` only — **not** Delete)
- [ ] Run `age-keygen` locally; store private key in 1Password + print a paper copy to a safe
- [ ] Add Railway env vars: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `BACKUP_AGE_RECIPIENT` (public key)
- [ ] Install `age` binary in the backend Dockerfile (`apt-get install age` — 50KB)
- [ ] Install `boto3` (Python S3 SDK, works with R2)
- [ ] New `backend/scripts/backup_db.py`:
  - Spawns `pg_dump $DATABASE_URL | gzip | age -r $BACKUP_AGE_RECIPIENT`
  - Streams the encrypted output to R2 with key `daily/YYYY-MM-DD.sql.gz.age`
  - On success, emits a log line with file size + duration for monitoring
- [ ] Add APScheduler job: daily at 03:00 UTC (reusing existing scheduler that handles onboarding emails + app_ranks sync)
- [ ] Retention: lifecycle rule on the bucket keeps last 30 daily + 12 monthly (R2 supports S3-style lifecycle rules)
- [ ] Alert path: if backup job fails 2 days in a row, send email to admin via existing Resend integration

### Phase 2B — manual backup endpoint (Layer 3)

- [ ] `POST /admin/backup/snapshot` → triggers the same flow but with key `manual/YYYY-MM-DD-HHMM.sql.gz.age`
- [ ] Admin dashboard button: "🗄️ Snapshot Now" with confirmation dialog
- [ ] Shows last backup timestamp + size in the Overview page (sanity check that cron is healthy)

### Phase 2C — restore drill (critical — do not skip)

- [ ] **Document the exact restore procedure** in `docs/backup-restore-runbook.md`:
  - Download `.sql.gz.age` from R2
  - `age -d -i ~/keys/endura-backup.key` → pipe to `gunzip` → pipe to `psql`
  - Verify row counts against a known reference snapshot
- [ ] **Actually do a test restore** against a scratch Railway Postgres instance within 1 week of Phase 2A going live. A backup you haven't tested restoring is not a backup.
- [ ] Repeat the drill quarterly.

---

## What we're explicitly NOT doing

| Idea | Why we're skipping |
|---|---|
| Dump to GitHub private repo (plaintext) | Plaintext PII in a third-party cloud; GitHub PAT leak = total compromise |
| Dump to GitHub private repo (encrypted) | Works but worse than R2 — PAT scope too broad, 2GB asset limit, deleted-asset caching |
| Dropbox / Google Drive | OAuth ceremony not worth it vs. R2 |
| Full logical + WAL shipping | Massive overkill at our scale; Railway PITR covers it |
| Daily dumps downloaded to a laptop | Doesn't survive laptop loss; not tested; manual-only is how people forget to do backups |

---

## Cost estimate (when built)

- Cloudflare R2: free (well under 10 GB tier for years)
- Resend alert email: free (we already have it)
- Railway Pro backups: $5/month (already paying)
- Engineering time: ~4 hrs for Phase 2A, ~1 hr for Phase 2B, ~2 hrs for restore drill + runbook
- **Total ongoing cost after build: $0 beyond Railway Pro**

---

## Reference — what's in a backup

For GDPR / incident-response preparedness, a `pg_dump` of our current schema contains:

- `users` — emails, usernames, school/country free-text fields, bcrypt password hashes, verification tokens, `eco_credits_multiplier`
- `study_sessions` — durations, timestamps, subjects
- `friendships`, `study_groups`, `group_members` — social graph
- `donations` — Stripe charge IDs (no raw card data; that lives at Stripe)
- `user_feedback` — bug reports / feature requests (may contain free-text user complaints)
- `user_badges`, `user_animals`, `user_purchases` — progression state
- `email_logs` — delivery / open / click events

Roughly **PII-heavy but not financial**. Stripe is PCI-DSS compliant separately; we don't store card numbers, tokens, or bank details. The big risk in a plaintext leak is **email list exposure + social graph inference**, not direct fraud.
