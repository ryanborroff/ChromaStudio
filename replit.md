# ChromaStudio

A premium, cinematic professional filmmaker platform for video hosting, networking, and client delivery.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/chroma run dev` — run the frontend (Vite, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Wouter (routing), TanStack Query
- Auth: Sign in with Google + Apple (Passport OAuth) and email/password (bcryptjs); Postgres-backed sessions (`express-session` + `connect-pg-simple`)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/chroma/src/` — React frontend
  - `pages/` — all page components (home, feed, explore, profile, videos, messages)
  - `components/` — shared UI components (layout, navbar, shadcn/ui)
  - `lib/queryClient.ts` — TanStack Query client singleton
  - `index.css` — cinematic dark theme, Tailwind layers, Clerk integration
- `artifacts/api-server/src/` — Express backend
  - `routes/` — users, videos, follows, feed, messages, projects, stats, health, storage
  - `lib/auth.ts` — session auth helpers (`requireAuth`, `getCurrentUser`)
  - `lib/passport.ts` — Passport strategies (Google, Apple) + username generation
  - `lib/objectStorage.ts`, `lib/objectAcl.ts` — Replit Object Storage service + ACL helpers
  - `routes/auth.ts` — Google/Apple OAuth + email register/login/logout
  - `routes/storage.ts` — image upload (presigned URL) + public object serving
- `lib/object-storage-web/` — client upload helpers (`useUpload`, `ObjectUploader`)
- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/api-client-react/` — generated TanStack Query hooks (do not hand-edit)
- `lib/db/src/schema/` — Drizzle ORM schemas (users, videos, follows, messages, projects)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks used in frontend and Zod schemas in backend
- Auth via Passport + server sessions stored in Postgres (`user_sessions` table); users created on first OAuth login or email registration. Sensitive fields (`googleId`, `appleId`, `email`, `passwordHash`) are stripped from all API responses
- All routes registered in `artifacts/api-server/src/routes/index.ts`
- Frontend uses Wouter for routing (lightweight)
- Cinematic dark theme: background `#0B0B0B`, card `#181818`, accent `#6B5BFF`, font Inter

## Product

- **Home** — landing page with hero and feature overview
- **Feed** — personalized video feed from followed filmmakers
- **Explore** — browse and search all public videos with sorting
- **Profile** — filmmaker profiles with cover image, portfolio videos, and follow system
- **Messages** — direct messaging between filmmakers, with **file attachments** (any type ≤50 MB via `POST /api/storage/uploads/request-file-url`); a message needs text or an attachment. Images preview inline, other files show a downloadable card. `messages` table has nullable `attachment_url/name/type/size` columns; `attachment_url` must be a `/api/storage/objects/...` path (validated server-side to block `javascript:`/external URLs)
- **Video Detail** — embed player, likes, comments
- **Media Library** (`/studio/storage`) — Dropbox-style manager: collections (folders) + categories (reel/showreel/rushes/other), move videos, filter by collection/category/uncategorized
- **Share & embed** — per-video share links (`/watch/:token`) with optional password protection; embeddable player (`/embed/:token`) for external sites (rendered outside the app Layout). **Paid-only**: only users on a paid plan (`users.plan !== "free"`) can enable share/embed links; free users see an upgrade prompt in the Share dialog
- **Client Delivery** (`/studio/delivery`) — upload any files (cuts, stills, docs, ZIPs ≤50 MB each via `request-file-url`) into a delivery and send a client a private download link (`/deliver/:token`), optionally password-protected. `deliveries` table (token, optional bcrypt `passwordHash`) + `delivery_files` (internal `objectPath`, never exposed to clients). Public `GET /deliveries/shared/:token` omits files when locked; `POST .../unlock` verifies the password and returns a stateless signed `downloadKey` (HMAC of token+expiry, 24h); `GET .../files/:fileId/download` requires a valid key for protected deliveries, then streams the file with `Content-Disposition: attachment` + `nosniff`. Not paid-gated
- **Dev login (production-safe)** — discreet "Dev login" affordance on the auth page (`/sign-in`) → `POST /api/auth/dev-login`, gated by the `DEV_LOGIN_PASSWORD` secret. Lets the owner skip OAuth and sign into a shared demo account (`demo@chroma.app`, created on first use) in BOTH dev and production. Constant-time password compare (sha256 + `timingSafeEqual`) + per-IP rate limit (5 attempts/15 min, in-memory; cleared on success). Distinct from the `/api/dev/*` helpers, which are `NODE_ENV==="development"` only
- **Plans** — `users.plan` column (`free` default; `creator`/`studio` = paid) gates paid features. Account badge in the user menu reflects the live plan

## User preferences

- **Git workflow**: Work on `main` directly. Pull Devin's latest merged PRs before starting (`git pull origin main`). Commit and push Replit progress to `main` before handing off to Devin. Short-lived local branches are fine for experiments; merge back to `main` when done. Never commit secrets to tracked files.

## Gotchas

- `pnpm run typecheck` is the canonical check; don't rely on editor/LSP alone
- After adding new routes, always import them in `artifacts/api-server/src/routes/index.ts`
- `lib/api-client-react/` is auto-generated — run codegen after any OpenAPI spec changes
- Session cookie is `sameSite: "lax"` + `secure` (lax preserves CSRF protection; Apple works via signed id_token rather than session-stored OAuth state). Secure cookies only round-trip over HTTPS, so test sessions against the HTTPS dev domain, not `http://localhost`
- The `user_sessions` table is created via raw SQL, not `createTableIfMissing` (connect-pg-simple can't read its `table.sql` from the esbuild bundle)
- `drizzle push` prompts interactively (TTY) — apply column changes with raw SQL `ALTER TABLE` instead
- Google/Apple sign-in require OAuth secrets; without them those routes return 503 but email/password still works
- **Dev auth (development only)**: the app starts **signed out** by default so the public, pre-login experience (landing/Explore) loads. Visit `/api/dev/login` to enter a demo account (user id 1) and explore the full signed-in app; `/api/dev/logout` to leave it. `clearDevSessions()` runs on boot (`DELETE FROM user_sessions`) so every restart begins signed out. These `/api/dev/*` helpers are gated on `NODE_ENV === "development"` and never exist in production. To preview the paid vs free experience (e.g. paid-only sharing/embedding), hit `/api/dev/plan/creator` to go paid or `/api/dev/plan/free` to drop back (whitelist: free/creator/studio)
- **Video serializers**: `buildVideoResponse` (videos.ts) is the canonical sanitizer, but `feed.ts`, `stats.ts`, `users.ts` and `collections.ts` serialize videos independently. Any sensitive `videosTable` column (e.g. `shareToken`, `sharePasswordHash`) must be stripped in **all** of them — non-owner contexts set `shareToken: null` + `hasSharePassword: !!sharePasswordHash`
- File/image uploads use **Cloudflare R2** (migrated off Replit Object Storage; see `lib/r2Client.ts` / `lib/objectStorage.ts` — requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Avatars/covers/thumbnails are public-by-design and served unauthenticated via `GET /api/storage/public-objects/*`. Everything else (private uploads, delivery attachments) is served via `GET /api/storage/objects/*`, which **requires auth** (fixed in commit `a976175` — previously had no ACL check, now closed). Store the serving URL `/api/storage{objectPath}` in DB. `request-url` endpoint = image-only ≤10 MB; `request-file-url` = any type ≤50 MB (DM attachments). Both require auth to request an upload URL. The serve routes set `X-Content-Type-Options: nosniff` and force `Content-Disposition: attachment` for scriptable types (html/svg/js/xml) to prevent stored-XSS from arbitrary uploads
- **Video streaming provider** is auto-selected at runtime by which env vars are set, priority order in `lib/streaming/index.ts`: Mux → Cloudflare Stream → raw R2 fallback (no transcoding). Mux is code-complete (webhook, thumbnails, adaptive HLS) and is the one actually configured in the deployed environment. Cloudflare Stream's upload/playback code exists but **has no webhook handler** — not usable until that's built. Switching providers later is just an env var change, no re-architecture

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Google OAuth redirect URI: `https://<domain>/api/auth/google/callback`; Apple: `https://<domain>/api/auth/apple/callback`
