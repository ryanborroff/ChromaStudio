# Threat Model

## Project Overview

Chroma is a Node.js/Express API (port 8080) with a React/Vite frontend — a premium cinematic platform for video hosting, networking, and client delivery. Users can upload and share videos, exchange direct messages with file attachments, deliver files to clients via password-protected delivery links, and collaborate via review links. Auth is Express-session backed by PostgreSQL, using Google OAuth, Apple OAuth, or email/password. Deployed publicly on Replit.

## Assets

- **User credentials** — email addresses, bcrypt-hashed passwords, Google/Apple OAuth IDs. Compromise allows account takeover and access to all user content.
- **Uploaded files** — video files, thumbnail images, delivery attachments, DM attachments stored in Replit Object Storage. May include confidential client work.
- **Session tokens** — Postgres-backed express-session cookies. Compromise allows impersonation.
- **Delivery packages** — confidential client files (cuts, stills, ZIPs) uploaded by filmmakers and gated by token + optional bcrypt password.
- **Application secrets** — `SESSION_SECRET` (HMAC signing), `MUX_WEBHOOK_SECRET`, `DEV_LOGIN_PASSWORD`, database URL. Leakage of `SESSION_SECRET` enables forging download keys.
- **User plan/subscription state** — `users.plan` gates paid features (share/embed links). Escalation to paid plan bypasses monetization.
- **Admin status** — `users.isAdmin` grants full user-management access.

## Trust Boundaries

- **Browser → API** (`/api/*`): all client requests cross here; API must authenticate and authorize each one. Client is fully untrusted.
- **API → PostgreSQL**: direct Drizzle ORM access; SQL injection at API layer would expose entire database.
- **API → Replit Object Storage**: private object storage for delivery files and DM attachments; should require authorization for non-public objects.
- **Public → Authenticated surface**: `/sign-in`, `/watch/:token`, `/deliver/:token`, `/embed/:token`, `/review/:token` are public; everything else in the studio should require a session.
- **Authenticated → Admin**: admin routes (`/api/admin/*`) require `isAdmin = true` in the session user record.
- **Owner → Shared/external**: share tokens and delivery tokens cross from owner-controlled space to public/client space; must not expose sensitive owner data.

## Scan Anchors

- **Entry points**: `artifacts/api-server/src/routes/index.ts` registers all routes; `artifacts/api-server/src/app.ts` configures middleware.
- **Highest-risk areas**: `routes/storage.ts` (object serving, commented-out ACL), `routes/deliveries.ts` (password-gated file downloads), `routes/auth.ts` (login brute-force surface), `routes/admin.ts` (admin privilege check).
- **Public surfaces**: `GET /api/share/:token`, `GET /api/review/:token`, `GET /api/deliveries/shared/:token`, `GET /api/storage/objects/*` (no auth), `GET /api/storage/public-objects/*`.
- **Authenticated surfaces**: `/api/users/*`, `/api/videos/*`, `/api/messages/*`, `/api/deliveries/*` (owner routes), `/api/admin/*`.
- **Dev-only**: `artifacts/api-server/src/lib/devAuth.ts` — gated on `NODE_ENV === "development"`; not present in production.

## Threat Categories

### Spoofing / Authentication

Users authenticate via Passport sessions. The `requireAuth` middleware checks `req.isAuthenticated()` before all protected routes. The `DEV_LOGIN_PASSWORD`-gated `/auth/dev-login` endpoint (accessible in production) has a 5-attempt/15-min per-IP in-memory rate limit, constant-time comparison, and auto-creates a shared demo account. No general rate limiting exists on `/auth/login` or `/auth/register`, creating a brute-force surface.

### Information Disclosure

`GET /api/storage/objects/*` serves all private object-storage files (delivery attachments, DM attachments) **without authentication**; the ACL check is commented out. This bypasses the password/token gate on delivery downloads and exposes private DM attachments to anyone who can guess or enumerate object paths. `GET /api/users` and `GET /api/users/:username` are public and expose all profile data (minus credentials); this is intentional.

### Elevation of Privilege

`PATCH /api/videos/:id` accepts `streamStatus` from the client via `UpdateVideoBody`; a user can freely set their video's stream-status to any string (e.g., "ready"), affecting review-link eligibility. Admin routes check `isAdmin` server-side. `PATCH /users/me` accepts only safe profile fields (plan, isAdmin are not in `UpdateMeBody`), so privilege escalation via profile update is not possible.

### Tampering

Delivery file paths are validated to start with `/objects/` before insertion. Message attachment URLs are validated to start with `/api/storage/objects/`. Video prices are not a concept (no e-commerce). No unsigned inter-service data paths identified.

### Denial of Service

List endpoints (`GET /videos`, `GET /users`, `GET /admin/users`) accept client-supplied `limit` and `offset` without an enforced upper bound, allowing large database reads from unauthenticated (for public endpoints) or authenticated callers. No global rate limiting is applied to the API.

### Repudiation

Pino HTTP logger is configured but strips query parameters from logged URLs. Sensitive operations (login, delivery access, admin actions) generate minimal audit trail.
