---
name: Prod vs dev demo/seed users
description: Why production-available logins must not rely on hardcoded dev user IDs
---

The published (production) deployment uses its own database, separate from the
development DB. Any account that only exists in dev (e.g. the `DEMO_USER_ID = 1`
used by the `NODE_ENV==="development"` auto-login helpers) will NOT exist in prod.

**Rule:** any feature that must work in production (e.g. the password-gated
`/api/auth/dev-login`) must find-or-create its account by a stable identifier
(a fixed email like `demo@chroma.app`), never by a hardcoded numeric id.

**Why:** a prod login that looks up user id 1 silently fails because the prod DB
starts empty / has different ids.

**How to apply:** for cross-environment seed/demo logic, ensure-then-login on a
stable natural key, not an autoincrement id.
