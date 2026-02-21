# Endura Security Guide

A breakdown of every security measure in the Endura app, why each one matters, and what real-world attacks they prevent.

---

## 1. Authentication & Secrets

### JWT Secret Key — No More Hardcoded Fallback

**What we changed:** The JWT signing key used to have a hardcoded default (`endura-secret-key-change-in-production-2024`) that would be used if the environment variable wasn't set. Now the app **refuses to start in production** without a proper `SECRET_KEY`.

**Why it matters:** JWTs (JSON Web Tokens) are how we prove "this request is from user X." They're signed with a secret key — if an attacker knows that key, they can forge tokens for ANY user. A hardcoded key that's visible in source code means anyone who can see your code (GitHub, a leaked repo, a disgruntled contributor) can impersonate any user.

**Attack prevented:** **Token forgery / session hijacking.** An attacker crafts a JWT with `{"sub": "admin@endura.eco"}`, signs it with the leaked key, and now they ARE that user — they can read their data, delete their animals, spend their coins.

**How to set it:** On Railway, run:
```
railway variables set SECRET_KEY=$(openssl rand -hex 32)
```
This generates a random 256-bit key that only exists on the server.

---

### Token Expiry Reduced from 30 Days to 7 Days

**What we changed:** Login tokens used to last 30 days. Now they expire after 7 days.

**Why it matters:** If someone's phone is stolen or a token is intercepted, the window of abuse is much smaller. 30 days means an attacker has a month to do damage with a stolen token. 7 days limits the blast radius.

**Attack prevented:** **Stolen token abuse.** If a token leaks (via network sniffing, a compromised device, or a shared computer), the attacker has less time to exploit it.

---

### Password Strength Validation

**What we changed:** Added server-side validation requiring passwords to be at least 8 characters with at least one letter and one number.

**Why it matters:** Without this, users could set their password to `1` or `aaa`. Weak passwords are trivially cracked — attackers use lists of common passwords (called "dictionary attacks") and can try millions per second.

**Attack prevented:** **Brute force / credential stuffing.** An attacker tries common passwords (`password`, `123456`, `qwerty`) against every account. Strong passwords make this exponentially harder.

---

### Passwords Hashed with bcrypt (Already In Place)

**What was already good:** Passwords are stored as bcrypt hashes, never in plaintext.

**Why it matters:** If the database is ever breached (SQL injection, stolen backup, insider threat), attackers get hashes — not passwords. Bcrypt is intentionally slow, making it extremely expensive to crack each hash. Even with powerful hardware, cracking a single bcrypt hash takes significant time.

**Attack prevented:** **Database breach / password theft.** Unlike MD5 or SHA-256 (which can be cracked at billions per second), bcrypt with a salt makes mass password cracking infeasible.

---

### Auth Tokens in SecureStore (Already In Place)

**What was already good:** The frontend stores JWT tokens in Expo SecureStore, which uses the iOS Keychain / Android Keystore — hardware-backed encrypted storage.

**Why it matters:** If tokens were stored in AsyncStorage or localStorage, any malicious app or script could read them. SecureStore encrypts them at the OS level and ties them to the app's identity.

**Attack prevented:** **Token theft from device storage.** A malicious app or a forensic dump of the phone can't read tokens from SecureStore without the device unlock credential.

---

## 2. Rate Limiting

### Login: 10 Requests/Minute — Register: 5 Requests/Minute

**What we added:** The `slowapi` library now limits how many times a single IP address can hit the login and register endpoints.

**Why it matters:** Without rate limiting, an attacker can try thousands of passwords per second against your login endpoint. This is called a brute force attack. Rate limiting forces them to slow down dramatically — 10 attempts per minute means it would take ~19 years to try the 100 million most common passwords.

**Attack prevented:**
- **Brute force login attacks** — trying every possible password
- **Credential stuffing** — using stolen username/password pairs from other breached sites
- **Account enumeration** — rapidly testing emails to see which ones have accounts
- **Registration spam** — bots creating thousands of fake accounts

---

## 3. Endpoint Protection

### Push Token Endpoint Now Requires Authentication

**What we changed:** `POST /users/{user_id}/push-token` used to accept requests from anyone. Now it requires a valid JWT AND verifies the authenticated user matches the `user_id`.

**Why it matters:** Without auth, an attacker could call `POST /users/42/push-token` with their own push token, and ALL notifications meant for user 42 would go to the attacker's device instead. They'd see friend requests, badge notifications, donation confirmations — everything.

**Attack prevented:** **Push notification hijacking.** An attacker redirects another user's push notifications to their own device, potentially leaking private information.

---

### Notification Send Endpoint Now Requires Authentication

**What we changed:** `POST /notifications/send` used to be completely open. Now it requires a valid JWT.

**Why it matters:** This endpoint sends push notifications to any list of users. Without auth, anyone could spam every user with fake notifications — "You won $1000! Click here" — leading to phishing or just destroying user trust.

**Attack prevented:** **Notification spam / phishing.** An attacker sends fake push notifications to all users, potentially directing them to malicious websites.

---

### Debug Endpoints Removed

**What we changed:** Removed `/debug/tips-count` and `/webhook/every-org/debug` from production.

**Why it matters:** Debug endpoints expose internal data — database record counts, raw webhook payloads (which may contain donor email addresses and payment amounts), and internal system state. This is called **information disclosure** and it helps attackers map your system.

**Attack prevented:** **Information disclosure / reconnaissance.** Attackers use debug endpoints to understand your database structure, find vulnerabilities, and extract sensitive data. The webhook debug endpoint was literally returning raw donation payloads with donor names and emails.

---

### Health Check Sanitised

**What we changed:** The health check used to return the database URL (including hostname, port, and credentials preview), a list of environment variable names, and the database type. Now it returns only `status`, `app`, and `version`.

**Why it matters:** The old health check was a goldmine for attackers:
- **Database URL preview** reveals the hosting provider, database type, and connection format
- **Environment variable names** reveal what services you use (STRIPE, POSTGRES, etc.)
- This information makes targeted attacks much easier

**Attack prevented:** **Server fingerprinting / information disclosure.** Knowing you use PostgreSQL on Railway with Stripe integration tells an attacker exactly which exploits to try.

---

## 4. Input Validation & SQL Injection

### Parameterised SQL Queries in Migrations

**What we changed:** Migration code used f-strings to build SQL queries:
```python
# BEFORE (vulnerable)
f"WHERE table_name='{table}' AND column_name='{col}'"

# AFTER (safe)
text("WHERE table_name=:tbl AND column_name=:col"), {"tbl": table, "col": col}
```

**Why it matters:** SQL injection is one of the most dangerous web vulnerabilities. Even though the migration values were hardcoded (low immediate risk), the pattern is dangerous. If anyone ever modified the migration list to include user input, it would be instantly exploitable.

**Attack prevented:** **SQL injection.** An attacker crafts input like `'; DROP TABLE users; --` which, when inserted into an f-string query, would delete your entire users table. Parameterised queries treat input as DATA, never as SQL code — the database engine handles the escaping.

---

### Input Bounds Validation

**What we added:** Pydantic validators with concrete limits:
- `duration_minutes`: 1–480 (can't study for negative minutes or 10,000 hours)
- `title`: max 200 characters
- `description`: max 1,000 characters
- `priority`: 0–2

**Why it matters:** Without bounds, an attacker could send `duration_minutes: 999999999`, earning billions of coins per session. Or send a 10MB title string to crash your database or consume all its storage.

**Attack prevented:**
- **Business logic abuse** — earning infinite coins with absurd study times
- **Resource exhaustion** — sending massive strings to fill up database storage
- **Integer overflow** — extremely large numbers causing unexpected behaviour

---

### Error Message Sanitisation

**What we changed:** Error responses used to include raw Python exception messages:
```python
# BEFORE
raise HTTPException(status_code=500, detail=str(e))
# This might return: "sqlalchemy.exc.OperationalError: connection to server at '10.0.0.1' port 5432..."

# AFTER
raise HTTPException(status_code=500, detail="Failed to create session")
```

**Why it matters:** Raw error messages reveal:
- Internal IP addresses and ports
- Database table and column names
- Library versions and stack traces
- File paths on the server

All of this helps an attacker craft more targeted exploits.

**Attack prevented:** **Information disclosure via error messages.** Attackers intentionally send malformed requests to trigger errors and learn about your system internals.

---

## 5. Database Security

### SSL Encryption for PostgreSQL

**What we added:** Production database connections now require SSL (`sslmode: require`).

**Why it matters:** Without SSL, all data between your app server and database travels in plaintext. On shared networks (like cloud infrastructure), this means anyone who can sniff network traffic can read every SQL query and response — including user emails, hashed passwords, and session data.

**Attack prevented:** **Man-in-the-middle (MITM) / network sniffing.** An attacker on the same network intercepts database traffic and reads all your data.

---

### Connection Pooling

**What we added:** `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`, `pool_recycle=300`.

**Why it matters:** This isn't just performance — it's also a security measure:
- `pool_pre_ping` tests connections before use, preventing crashes from stale connections
- `pool_recycle=300` rotates connections every 5 minutes, limiting the window if a connection is somehow compromised
- Size limits prevent a denial-of-service attack that opens thousands of database connections

**Attack prevented:** **Connection exhaustion DoS.** An attacker sends thousands of simultaneous requests, each opening a new database connection, until the database runs out of connections and crashes for everyone.

---

## 6. Frontend Security

### No Debug Logging in Production

**What we changed:** Removed all `console.log` calls that exposed API URLs, response data, and error details. Remaining logs only run when `__DEV__` is true (development builds).

**Why it matters:** In React Native, console logs are visible in the device's debug bridge. On jailbroken/rooted devices, any app can read another app's console output. Production logs should reveal nothing useful to an attacker.

**Attack prevented:** **Information leakage via device logs.** An attacker with physical access or a compromised device reads your console logs to learn API endpoints, auth flow details, and error patterns.

---

### PostHog Debug Mode Disabled in Production

**What we changed:** PostHog analytics SDK had `debug: true` and `flushAt: 1` (send every single event immediately). Changed to `debug: __DEV__` and `flushAt: 20`.

**Why it matters:** Debug mode logs every analytics event to the console, including user IDs and event properties. Flushing every event individually also increases network traffic and makes it easier to intercept individual events.

**Attack prevented:** **Analytics data leakage.** Debug logs reveal user behaviour patterns, internal event names, and user identifiers.

---

### Push Token Sent with Auth Header

**What we changed:** The push notification registration used to send the token without authentication. Now it includes the JWT Bearer token.

**Why it matters:** Without auth, the backend can't verify WHO is registering the push token. An attacker could register their device to receive another user's notifications.

**Attack prevented:** **Push notification interception** (see endpoint protection section above).

---

## 7. Logging Hygiene

### Print Statements Replaced with Logging Module

**What we changed:** All `print()` calls in auth code replaced with Python's `logging` module. No user emails or token payloads are logged.

**Why it matters:** `print()` outputs go to stdout, which is often captured in deployment logs (Railway, Vercel, etc.). These logs may be accessible to team members, CI/CD systems, or log aggregation services. Logging sensitive data (emails, tokens, passwords) in any form creates a secondary attack surface — if your log storage is breached, all that data is exposed.

**Best practice:** Log WHAT happened ("auth failed"), not WHO or WHAT WITH ("auth failed for user@email.com with token eyJ...").

---

## Quick Reference: Attack Types Prevented

| Attack | What It Is | Our Defence |
|---|---|---|
| Token forgery | Attacker creates fake auth tokens | Strong, secret JWT key |
| Brute force | Trying every password | Rate limiting + password rules |
| Credential stuffing | Using leaked passwords from other sites | Rate limiting |
| SQL injection | Malicious SQL in user input | Parameterised queries + ORM |
| Session hijacking | Stealing a valid token | 7-day expiry + SecureStore |
| Push notification hijacking | Redirecting someone's notifications | Auth-protected endpoints |
| Information disclosure | Learning system internals | Sanitised errors + no debug endpoints |
| Man-in-the-middle | Intercepting network traffic | SSL database connections + HTTPS |
| Denial of service | Overwhelming the server | Connection pooling + rate limiting |
| Business logic abuse | Exploiting missing validation | Input bounds checking |

---

## What's Still on the Roadmap

1. **Refresh tokens** — short-lived access tokens (15 min) + long-lived refresh tokens, so stolen access tokens expire quickly
2. **CORS lockdown** — currently `allow_origins=["*"]`; should restrict to your app's domain once in production
3. **Webhook signature verification** — verify Every.org webhooks are genuinely from Every.org using HMAC signatures
4. **Content Security Policy** — for the website, prevent XSS by restricting which scripts can run
5. **Dependency auditing** — regular `npm audit` and `pip audit` to catch known vulnerabilities in packages
6. **Two-factor authentication** — optional 2FA for user accounts
