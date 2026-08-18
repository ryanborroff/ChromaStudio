# Chroma – State of Play (v2)

**Prepared:** 2026-08-13 (updated from the 2026-08-12 audit)
**Repo audited:** ChromaStudio (local checkout, `main` @ `327e9b2`, plus uncommitted billing work — see note below)
**Survey source:** Tally "Filmmaker & Agency Research Survey" (form `WOBbDe`), **n = 6 completed responses**, collected 2026-07-16 to 2026-07-30

> ⚠️ **Sample size caveat:** the survey has only 6 completed responses. Every percentage below is out of 6 — treat directional signal as hypothesis-confirming, not statistically reliable.

> ✅ **Update 2026-08-14:** the Stripe billing work described below is confirmed **committed** (`a976175`, ancestor of current `main` `HEAD`) — the "uncommitted" framing throughout this doc is stale. It's committed but still *unconfigured* (no Stripe keys), which is the actual blocker, not git status.

> ✅ **Update 2026-08-14 — deployed to Railway.** Project `chroma-studio`: `chroma` (frontend) + `api-server` (backend) + Postgres, all live, schema pushed. **Mux is configured and active** as the streaming provider (`MUX_TOKEN_ID`/`MUX_TOKEN_SECRET`/`MUX_WEBHOOK_SECRET` set) — resolves the "which provider is actually configured" open question below. **Decision: stick with Mux (streaming) + Cloudflare R2 (file/image storage, zero egress fees) through the testing phase.** Cloudflare Stream's code path is real but incomplete (no webhook handler) and not worth building pre-launch — Mux is code-complete, already live, and cheap enough at testing volume (free trial credit). Revisit only if Mux's per-minute cost becomes material at real launch volume; switching is a two-env-var change per `lib/streaming/index.ts`, no re-architecture needed.

---

## What changed since the last audit

Three of the top four gap-list items from the previous pass have been built since `4478953`:

1. **Frame-accurate commenting** — was PARTIAL, now **WORKING**. Timecodes are captured from the actual player position (verified to sub-millisecond precision live, e.g. `4.418`s stored exactly), not typed. Click-to-seek works. Shipped for both the guest review-link flow and a newly-built owner-side composer that didn't previously exist.
2. **Version comparison** — was STUBBED, now **WORKING**. Owners can upload a new version attached to an existing review group, a version picker appears on both the owner's video page and the guest review link, and switching versions is clearly labeled (with feedback/approval locked to the latest version, and comments correctly scoped per-version — verified live).
3. **Billing (Stripe)** — was MISSING, now **built but not configured or committed**. Real checkout session creation, webhook-driven plan sync, and a customer portal link exist and typecheck cleanly, but there are no Stripe API keys anywhere yet, so none of it is live-testable end-to-end. See the readiness checklist below.

A fourth item (Cloudflare Stream webhook / provider-strategy mismatch) is **still open** — flagged again below since it's now the top remaining gap.

Everything else in this report (auth, video pipeline aside from the above, portfolio, dead code/tests/CI) is **unchanged since the last audit** — confirmed via `git diff --stat` against the prior audit commit, which shows zero touched files outside the review-workflow and billing work.

---

## User-Testing Readiness

This is the part that matters most for "test soon." Short version: **the core filmmaker↔client review loop is solid and testable today.** Billing is not, and shouldn't be part of this round unless you configure Stripe test-mode keys first.

### Golden path — status of each step

| Step | Status | Notes |
|---|---|---|
| Sign up / sign in (email+password) | ✅ Ready | Fully working, no config needed |
| Sign in with Google / Apple | ⚠️ Needs config | Code-complete but inert — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and Apple's 4 env vars are unset. 503s until configured. Fine to skip for this round if email/password is acceptable to testers. |
| Upload a video | ⚠️ Needs a provider configured | Falls back to raw object storage if no streaming provider is set, which works but has no transcoding/adaptive playback. **Recommend configuring Mux** — it's the only provider with a complete webhook lifecycle (see below). |
| Share a review link with a client | ✅ Ready | Password-optional, works either way |
| Client leaves frame-accurate comments (no account needed) | ✅ Ready | Verified live this session — exact sub-second precision, click-to-seek works |
| Owner reviews/resolves comments | ✅ Ready | Including a comment composer that didn't exist before this session |
| Owner uploads a new version | ✅ Ready | Verified live |
| Client compares versions | ✅ Ready | Version picker on the guest side too; feedback/approval correctly locked to latest version with a clear banner when viewing an older one |
| Client approves / requests changes | ✅ Ready | |
| Filmmaker views their public profile | ✅ Ready | |
| Filmmaker shows a curated public portfolio | ❌ Not ready | Collections exist but are private-only; `/studio/portfolio` is still a "Coming Soon" stub |
| Filmmaker upgrades to a paid plan | ❌ Not ready | Code exists, no Stripe keys configured — see below |

### Before you hand testers a link — infra checklist

- [ ] **Confirm where this is actually deployed.** I could not check Railway from this session (MCP not authenticated here) — verify the deployment target, that it's running `NODE_ENV=production`, and that it's on the latest commit (plus the uncommitted billing work, once you decide whether to include it in this round).
- [ ] **`NODE_ENV=production` in the real deployment, never `development`.** In dev mode, every unauthenticated request auto-signs in as a shared demo user (`devAuth.ts`) — this must not be reachable during real testing.
- [ ] **Database migrated**, including the new billing columns if you're including that work: `pnpm --filter @workspace/db run push`. Heads up — this prompted interactively when I ran it locally against a table with existing rows (adding a unique constraint); you may need to answer that prompt or apply the equivalent SQL directly in a non-interactive deploy context.
- [ ] **A streaming provider configured.** Recommend Mux (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET` + webhook URL registered in the Mux dashboard). If Cloudflare Stream is what's actually configured in production, uploads will get stuck in "processing" forever — there's still no webhook handler for it.
- [ ] **`PUBLIC_APP_URL` set** — used to generate review-link URLs and (new) Stripe checkout success/cancel URLs. Without it, links fall back to request-derived origin, which usually works but is worth setting explicitly.
- [ ] **`SESSION_SECRET` and `DATABASE_URL` set** (the app throws on boot without these — good, but confirm they're set in the real environment, not just locally).
- [ ] **If including billing in this round:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREATOR`, `STRIPE_PRICE_STUDIO`, `STRIPE_PRICE_TEAM` (create these as real recurring Prices in the Stripe dashboard, test mode is fine), plus a webhook endpoint pointed at `/api/webhooks/stripe`. **Recommend testing billing as a separate round** rather than blocking the review-workflow test on it — it's unconfigured and uncommitted right now.
- [ ] **Decide on the dev-login toggle.** It's visible on the sign-in page regardless of environment (503s harmlessly if `DEV_LOGIN_PASSWORD` is unset, but testers may notice and ask about it).

### Known rough edges to set expectations for

- No public portfolio/showcase yet (collections are private-only)
- No domain-restricted share links (password-only)
- No creator-facing analytics beyond a raw view count
- If Cloudflare Stream ends up being the configured provider instead of Mux, uploads will silently hang in "processing"
- Zero automated test coverage beyond nav-smoke — a regression during the testing sprint won't be caught automatically before a tester hits it

---

## Claimed vs. Built — Funding Application Commitments

> ⚠️ **These are not marketing copy.** Confirmed 2026-08-15: the eight items checked below (and the four AI-roadmap items further down) are commitments made in a **funding application**. No deadline attached yet, but the bar is different from a landing page — a funder's diligence (a follow-up call, a demo request, a milestone check-in) tests the gap between "committed" and "built" directly. Treat every ❌/⚠️ row below as something a funder could reasonably ask to see, not just a backlog item.

Checked against eight capability claims on 2026-08-14/15. Consolidated to seven rows — two of the eight claims describe the same underlying gap.

| Claimed | Status | Evidence |
|---|---|---|
| High-resolution raw file sharing for production collaboration *(asked twice, same gap)* | ❌ **Not built** | The generic file-sharing feature (`deliveries` — [routes/deliveries.ts](artifacts/api-server/src/routes/deliveries.ts)) is real but hard-capped **server-side at 50 MB/file** ([storage.ts:125](artifacts/api-server/src/routes/storage.ts#L125), `MAX_FILE_BYTES`, enforced not just UI copy) — far below camera-original scale. The video pipeline (Mux/R2) can take larger files when a provider is configured, but the upload picker rejects anything whose browser-reported MIME type isn't `video/*` ([video-upload.tsx](artifacts/chroma/src/pages/video-upload.tsx)), which commonly excludes true camera-RAW formats (BRAW, R3D, ARI). No chunked/resumable upload outside Mux's own uploader either — a dropped connection on a multi-GB file means starting over. |
| Option to create low-resolution proxies | ❌ **Missing entirely** | Zero references to "proxy"/"proxies" anywhere in the codebase. Not stubbed, not scaffolded, not on any prior gap list. |
| Secure, highly customizable links to WIP edits and completed films | ⚠️ **Partial — depends which link type** | Three separate link mechanisms exist with very different capability levels. Review links (WIP): password, expiry, independent download/comment toggles, revoke — genuinely rich. Video share links (finished work): password + on/off only, paid-plan-gated, no expiry. Delivery links (file downloads): password only. "Highly customizable" is fair for WIP review links, an overstatement for finished-film share links. |
| Frictionless client review, no account required | ✅ **Ready** | Verified live this session — guest review links, frame-accurate commenting to exact sub-second precision, approve/request-changes, all with zero sign-up. |
| Customizable public-facing portfolios | ⚠️ **Partial — profile yes, portfolio no** | Profile customization (name, profession, location, website, bio, 5 social links, avatar/cover) is real and public at `/profile/:username`. But portfolio *curation* — selecting/arranging a showcased body of work — isn't: `collections.ts` is fully built on the backend but every route requires auth, `profile.tsx` never surfaces it, and the dedicated `/studio/portfolio` destination is a "Coming Soon" stub. |
| Curated filmmaker community in one platform | ❌ **Not built** | `/community` is a "Coming Soon" stub with literal placeholder copy ("Filmmaker groups · Project collaborations · Community events") — zero backend. What does exist (follow/feed/explore) is real but is discovery/social infrastructure, not community (groups, discussion, curation). |
| Built-in AI-scraping protection | ❌ **Missing, unchanged** | `robots.txt` still `Allow: /` (wide open); zero watermarking or anti-scraping code anywhere. Confirmed both in the original audit and re-checked now. |

**Net read:** one of seven is ready today (frictionless client review — this is the one I can vouch for firsthand, having built and verified it this session). Two are honest-with-caveats (link customization, portfolios) — real underlying infrastructure but the specific claim oversells what's public/usable today. Four are not built at all: raw file sharing at production scale, proxy generation, curated community, and AI-scraping protection (the last one *was* flagged in the original audit, just not yet acted on).

**Given these are funder commitments, recommend two parallel tracks rather than treating this as one prioritized backlog:**
1. **Close the gap for real**, sequenced by the updated Gap List below (raw file sharing and proxies are now #6–#7, ahead of most existing gaps, given the source).
2. **Decide what to say if asked before it's built.** A funder question about a committed feature usually has a reasonable honest answer ("in active development, here's the architecture, here's the timeline") — but that answer needs to be decided and consistent, not improvised per-conversation. That's a conversation with whoever owns funder relations, not something I can resolve from the code.

### Planned AI features — checked for existing groundwork, found none

Framed as forward-looking plans rather than current claims, so the bar here is different: is there anything already in place to build on, or is this fully greenfield? Checked package.json in both apps and grepped the codebase for any trace of each.

| Planned feature | Groundwork found | Notes |
|---|---|---|
| Automated transcription/captioning (multi-language) | None | No transcription/captioning code, no speech-to-text SDK (no OpenAI, AWS Transcribe, Google Speech, Whisper) in either `package.json`. Mux does support auto-captioning as an add-on API on assets already flowing through it (`streamAssetId` is already stored) — worth checking before building this from scratch, since it may be a Mux API call away rather than a new pipeline. |
| Scene/image recognition for automated metadata tagging | None | No vision/ML SDK anywhere (no AWS Rekognition, Google Vision, etc.). `videosTable.tags` exists but is a plain user-picked array (`video-upload.tsx`'s checkbox list) — a real hook point to write auto-generated tags into, once something generates them, but nothing does yet. |
| AI-assisted search across footage libraries | None | Current search (`explore.tsx`, `GET /videos`) is a plain SQL `ILIKE` match on title/description ([routes/videos.ts](artifacts/api-server/src/routes/videos.ts)) — keyword substring matching, not semantic/AI search. No vector store, no embeddings anywhere in the stack. |
| Smart proxy generation | None | Same underlying gap as "low-resolution proxies" above — there's no proxy generation at all yet, "smart"/AI-assisted or otherwise. This is downstream of building basic proxy generation first. |

None of these have false starts or half-built scaffolding to work around — whoever scopes them is starting clean. The one thing worth flagging before scoping is the transcription item specifically: **check what Mux's captioning API already offers** before building a bespoke transcription pipeline, since Mux is already the streaming provider of record and this might be materially cheaper than it looks.

---

## Code Audit

Status tags: **WORKING** (built and reachable end-to-end) · **PARTIAL** (built but incomplete, gated, or missing a critical link) · **STUBBED** (scaffolding/schema exists, no real functionality) · **MISSING** (not present at all).

### Auth — unchanged since last audit

| Mechanism | Status | Evidence |
|---|---|---|
| Email/password | **WORKING** | Full register/login with bcrypt (cost 12), zod validation, real session (`artifacts/api-server/src/routes/auth.ts:75-148`) |
| Session management | **WORKING** | `express-session` + `connect-pg-simple` on Postgres, httpOnly/secure cookies, `requireAuth` applied across 61 route occurrences in 14 files |
| Google OAuth | **PARTIAL** | Code-complete, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` unset — 503s until configured |
| Apple OAuth | **PARTIAL** | Same pattern, all four required env vars unset |
| Firebase Auth | **MISSING** | Never implemented; Passport was used instead of the PRD's original plan |
| Dev-password login | **WORKING but risky** | Not `NODE_ENV`-gated — reachable in production if `DEV_LOGIN_PASSWORD` is ever set. Currently unset (503s), but the toggle button is visible to all users on the sign-in page |
| Dev auto-login bypass | **WORKING, correctly gated** | Only mounted when `NODE_ENV === "development"` |

### Video Upload, Storage & Playback — unchanged since last audit

| Component | Status | Evidence |
|---|---|---|
| R2 direct upload | **PARTIAL** | Works end-to-end but is only the fallback when no streaming provider is configured |
| Mux | **WORKING** (most complete) | Full webhook-driven lifecycle, adaptive HLS |
| Cloudflare Stream | **PARTIAL/mostly stubbed** | Upload + playback work; **still no webhook handler** — this is now the #1 remaining gap from the original list |
| Thumbnails | **PARTIAL** | Auto-generated only for Mux |
| Upload resilience | **WORKING but shallow** | Hourly sweep flags (doesn't retry) stuck uploads |
| Large-file/chunked upload | **STUBBED for R2/Cloudflare** | Only Mux does real chunked/resumable upload |
| **Security finding** | — | `GET /api/storage/objects/*` still serves private attachments with no authentication (ACL check commented out) — unchanged, still a live risk worth fixing before wide testing |

### Client Review Workflow — updated this session

| Capability | Status | Evidence |
|---|---|---|
| Commenting | **WORKING** | Unchanged |
| **Frame-accurate comments** | **WORKING** ✅ *(was PARTIAL)* | Captures the player's live `currentTime` on textarea focus and via an explicit "Use current time" button; manual override still available. Click-to-seek from any comment. Verified live: pausing at `4.418`s and `3.5`s stored those exact values with no rounding, for both guest and owner comments. New shared hook: `artifacts/chroma/src/hooks/use-player-time.ts`. |
| **Version comparison** | **WORKING** ✅ *(was STUBBED)* | Owner can upload a new version attached to an existing review group (`/videos/upload?reviewGroupId=...`); version picker on both `video-detail.tsx` (owner) and `review-page.tsx` (guest); switching to a non-latest version shows a clear banner and disables feedback/approval (which stay locked to latest, by design); comments correctly scoped per-version, not leaked across versions. New endpoints: `GET /videos/group/:reviewGroupId`, `POST /review/:token/versions/:videoId`. |
| Approval sign-off | **WORKING, but not an audit trail** | Unchanged — still a single mutable field, not append-only |
| Password-protected share links | **WORKING (3x over)** | Unchanged |
| Domain-restricted share links | **MISSING** | Unchanged |
| Delivery downloads/exports | **WORKING (deliveries)** / **PARTIAL (project export)** | Unchanged |
| **Bug found and fixed this session** | — | On a public (no-password) review link, a newly posted comment or approval decision saved correctly to the DB but never appeared in the UI until something else happened to populate local state. Fixed — see [commit 327e9b2](https://github.com/ryanborroff/ChromaStudio/commit/327e9b2). |

### Portfolio / Public Hosting — unchanged since last audit

| Capability | Status | Evidence |
|---|---|---|
| Public profile pages | **WORKING** | |
| Embed player | **PARTIAL** | Paid-plan gated; CORS locked to app's own domains |
| Curated collections/showcases | **STUBBED for portfolio use** | Private-only, never surfaced publicly |
| Analytics (creator-facing) | **STUBBED** | Raw view count only |
| Social/discovery | **WORKING** | Follows, feed, explore all real |

### Billing / Plans — built this session, not yet live

| Component | Status | Evidence |
|---|---|---|
| Stripe checkout | **WORKING (code), not configured** | `routes/billing.ts` — creates/reuses a Stripe customer, starts a subscription Checkout session. Typechecks clean, tested locally against a Postgres+api-server instance with no Stripe keys: fails gracefully (400, not a crash) as expected. |
| Stripe webhook | **WORKING (code), not configured** | `routes/webhooks.ts` `POST /webhooks/stripe` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Verified against the actual installed SDK's types (Stripe moved `current_period_end` off the top-level Subscription object onto subscription items in a 2025 API version — this is handled correctly). |
| Customer portal | **WORKING (code), not configured** | `POST /billing/portal-session` |
| Pricing page | **WORKING (code)** | Creator/Studio/Team buttons call real checkout; signed-out users route to `/sign-up?plan=X` with a resume-checkout-after-signup flow (email/password path only — not wired through Google/Apple OAuth) |
| Account billing UI | **WORKING (code)** | New "Billing" section on `/account/security` shows current plan + "Manage subscription" or "View plans" |
| **Net effect** | — | Code is real and correctly structured, but **no Stripe account/keys exist yet** and the work is **uncommitted**. Cannot process a real payment until `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and three price-ID env vars are set. |

### Dead Code, TODOs, Feature Flags, Tests, CI — unchanged since last audit

- 8 routes still render a generic `<ComingSoon>` stub (Live, Cinema, Replays, Portfolio, Embeds, Analytics, Store, Community)
- No feature-flag mechanism
- Still one Playwright nav-smoke spec, not run in CI; zero backend tests
- CI still typecheck/build only, no lint, no test step
- Anti-AI-scraping / watermarking / migration tooling still entirely absent

---

## Jobs to Be Done — updated

| Job to be Done | Survey Validation (n=6) | Chroma Status | Priority |
|---|---|---|---|
| Frame-accurate timestamped comments | Q13: 2nd-most-cited priority | **WORKING** ✅ *(was PARTIAL)* | Satisfied |
| Compare new cut against prior version | Implied by PRD, not directly surveyed | **WORKING** ✅ *(was STUBBED)* | Satisfied |
| Client can comment/approve without an account | Q7: 0/6 "not important" | **WORKING** | Satisfied |
| One flat-rate price covering review + portfolio | Q10/Q20/Q21 | **Built, not live** ⚠️ *(was STUBBED)* | Blocks revenue until Stripe is configured |
| Footage protected from AI-scraping | Q16: 0/6 "not important" | **MISSING** | High, unaddressed |
| Curated public portfolio | Q8: 4/6 "very important," but Q9 forced-choice favored review | **PARTIAL** | Medium, unaddressed |
| Domain-restricted access control | Q13: lowest-ranked review feature | **MISSING** | Low, unaddressed |
| Migrate library from another platform | Q15: 0/6 rated above "somewhat" | **MISSING** | Low — recommend deprioritizing, per prior audit |
| Active community on the platform | Q22: mostly "not important" | **WORKING** | Already over-built relative to demand |

---

## Gap List (Prioritized) — updated 2026-08-15

Deployed to Railway this session: Mux is now the configured streaming provider (resolves old #2's urgency — Cloudflare Stream is simply unused, no need to build its webhook). The object-storage auth hole (old #3) was already fixed in commit `a976175`, which is deployed. Renumbered; new #1 reflects that billing needs *configuration*, not more code.

**Confirmed 2026-08-15: items 5–7 are funding-application commitments, not hypothetical asks** — reordered above #8 (domain-restricted links) accordingly, since that one was never committed anywhere and was already low priority per survey data. No deadline attached yet, but "funded commitment with no deadline" still outranks "backlog item with low survey priority."

1. **Configure and commit the Stripe billing work.** The code is done — this is now an operational task: create Stripe Products/Prices, set five env vars, register the webhook endpoint, run the DB migration in the real environment. Recommend a separate, later test round once configured — don't bundle into the review-workflow round.
2. **Move Mux playback from `public` to `signed` policy.** Assets are currently created with `playback_policy: ["public"]` ([mux.ts:21](artifacts/api-server/src/lib/streaming/mux.ts#L21)) — Mux itself performs no per-user auth on playback, so a leaked/extracted playback URL bypasses ChromaStudio's own access control (login gate / share-link token / password) for that video, similar to an "unlisted" video. Fine for this test round; fix before handling sensitive/unreleased footage. Requires signed-token generation (JWT) and a token-issuing endpoint — a real code change, not a config flip.
3. **Ship an anti-AI-scraping posture.** *Funder commitment.* Validated demand too, zero implementation, cheap first step (robots.txt disallow rules for AI crawlers).
4. **Surface curated collections as a public portfolio feature.** *Funder commitment.* Backend already built; needs a public read route and a profile-page surface. Cheapest of the funder-committed gaps to close — this is real wiring work, not new architecture.
5. **High-resolution raw file sharing for production collaboration.** *Funder commitment.* Currently capped at 50 MB/file with no chunked upload — nowhere near camera-original scale. Real scope: a much higher (or removed) size ceiling, real multipart/resumable upload (the existing Uppy `ObjectUploader` already has multipart support in its dependency, just disabled — `shouldUseMultipart: false`), and either relaxing or removing the `video/*` MIME check for this specific upload path so RAW camera formats aren't rejected client-side. This is the biggest engineering lift of the funder-committed items — sequence it first among them regardless, since #6 depends on it existing.
6. **Low-resolution proxy generation.** *Funder commitment.* Fully greenfield — no code, no schema field pairing an original with a proxy. Real scope: a transcode step (ffmpeg job, or a provider API if one's already in the stack) triggered on upload, a `proxyUrl`/`proxyStatus` pairing in the video schema, and a UI toggle to play proxy vs. original. Sequenced after #5 — low value without larger raw files to make proxies *of*.
7. **Curated filmmaker community.** *Funder commitment.* `/community` is currently a placeholder with no backend. This is the largest scope item of the three — closer to a new product surface (groups, discussion, curation) than a gap-fill, and survey signal (Q22) shows real users don't rank it highly. Recommend treating this as its own scoping/timeline conversation rather than sequencing it like the others — "committed" doesn't tell you how much of it needs to exist to satisfy the commitment.
8. **Add domain-restricted share links.** Low priority per survey, not a funder commitment, cheap to bolt onto the existing password-check pattern whenever it's picked up.
9. **Decide on migration tooling — likely deprioritize.** Survey data doesn't support it as a priority.
10. **Backfill test/CI coverage.** More urgent now that billing exists — a regression in checkout or webhook handling is a money bug, not just a UX bug. Recommend this lands before or alongside the billing configuration work in #1.
11. **Isolate ChromaStudio's Mux usage from the account owner's personal assets**, if that separation ever matters (e.g. cost tracking, avoiding mixing personal and product video). Currently both share one Mux account/token — normal for a single-tenant-infra SaaS setup, but worth a dedicated Mux account later if it becomes a practical problem.

### AI roadmap — funder commitments, not yet prioritized against the above

Four more items are also funding-application commitments: automated transcription/captioning, scene/image recognition for auto-tagging, AI-assisted search, and smart proxy generation. All four are fully greenfield (see the groundwork check above) — no false starts to account for, but also nothing to build on. Deliberately not folded into the numbered list above since these are a different kind of decision (multi-provider-API roadmap bets, not gap-fills) and "no deadline yet" gives room for a real scoping pass rather than slotting them in by guesswork. One live lead: check Mux's own captioning API before scoping transcription from scratch, since Mux is already the provider of record for every asset in the system.

---

## Open Questions / Assumptions Flagged

- **Deployment target unverified.** I don't have visibility into what's actually running on Railway (or wherever this is hosted) from this session — confirm before sending testers a link that the deployed build includes the review-workflow and billing commits, `NODE_ENV=production` is set, and the DB migration has run.
- **Whether to include billing in this testing round at all.** Recommend treating it as a separate, later round once Stripe test-mode keys are configured — bundling an unconfigured checkout flow into a workflow-testing round risks testers hitting a dead end and reading it as broken rather than "not turned on yet."
- **Google/Apple OAuth** are still unconfigured — decide whether email/password alone is acceptable for this round or whether testers specifically need social login.
- Carried forward from the prior audit: sample size (n=6) is small; migration-tool priority contradicts the original brief; which streaming provider is actually configured in production was never determinable from the local repo.
- **Resolved 2026-08-15:** the eight claimed-vs-built capabilities and four AI-roadmap items are **funding application commitments**, confirmed by the founder. No deadline attached yet. This has been folded into the Gap List priority ordering above — the four confirmed-not-built items (raw file sharing, proxies, community, AI-scraping protection) now rank ahead of lower-stakes backlog items regardless of survey priority. Still open: whether there's a milestone/reporting cadence tied to the funding (quarterly update, board deck, etc.) that would turn "no deadline yet" into a real one — worth checking with whoever manages that relationship before assuming there's no time pressure.
