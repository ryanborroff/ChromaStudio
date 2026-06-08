---
name: Auth & session gotchas (Chroma)
description: Non-obvious constraints for the Passport + Postgres-session auth (Google/Apple OAuth + email/password) in the Chroma app.
---

# Auth & session gotchas

## connect-pg-simple `createTableIfMissing` breaks in esbuild bundles
`createTableIfMissing: true` makes connect-pg-simple read its `table.sql` from disk relative to its module; the api-server is bundled by esbuild, so the file isn't present and session writes fail with `ENOENT ... dist/table.sql` (500 on first login/register).
**Why:** the bundle flattens module layout, breaking the relative file read.
**How to apply:** create the `user_sessions` table via raw SQL and set `createTableIfMissing: false`.

## Apple form_post vs `sameSite` cookies — keep `lax`, skip Apple OAuth state
Apple's OAuth callback is a cross-site `form_post` (POST from appleid.apple.com). A `sameSite: "lax"` cookie is NOT sent on that POST, so session-stored OAuth `state` can't be validated for Apple.
**Why:** `sameSite: "none"` would fix Apple state but sends the session cookie on ALL cross-site requests, removing the browser-level CSRF mitigation app-wide — a worse tradeoff than dropping Apple's state nonce.
**How to apply:** keep `sameSite: "lax"` + `secure: true`. Do NOT set `state: true` on the Apple strategy (it would break login since the state cookie won't return). Apple login still works: the callback POST creates the session, sets the cookie on the redirect response, and the browser sends it on the same-site GET to /feed. Integrity comes from Apple's signed id_token. Google keeps `state: true` (its GET-redirect callback carries the lax cookie fine).
**curl note:** Secure cookies only go over HTTPS — test sessions against the HTTPS dev domain, never `http://localhost` (curl silently drops the Secure cookie over http → spurious 401s).

## Apple only sends the user's name once
The name arrives as a JSON string in the form-posted `user` field on the *first* authorization only; the id token has `sub` + `email` but no name. Parse `req.body.user` and fall back to a default on later logins.

## drizzle push is interactive
`pnpm --filter @workspace/db run push` blocks on a TTY prompt in this environment. Apply additive column changes with raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` SQL instead.

## PII stripping is manual per-route
There is no central serializer — every route that returns a user row must strip `googleId`, `appleId`, `email`, `passwordHash`. When adding a sensitive user column, update every destructure (users.ts, videos.ts x3, projects.ts, auth.ts publicUser) or it leaks.
