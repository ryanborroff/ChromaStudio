# Chroma – Devin Build Prompts (Top 3 Gaps)

Drafted from [chroma-state-of-play.md](chroma-state-of-play.md) gaps #1–#3. Each prompt is self-contained — written for an agent with no memory of the audit conversation, so it repeats the relevant context.

---

## Prompt 1: Stripe Billing Integration

```
Chroma is a filmmaker video-hosting/client-review platform (React/Vite/TS frontend
in artifacts/chroma, Express backend in artifacts/api-server, Postgres/Drizzle
schema in lib/db, pnpm monorepo). It currently has ZERO payment processing — the
pricing page (artifacts/chroma/src/pages/pricing.tsx) displays 5 real tiers
(Free $0 / Creator $19/mo / Studio $45/mo / Team $79/mo / Enterprise custom) but
every "Choose Plan" CTA just links to /sign-up with no plan captured. The only
code path that ever changes a user's plan today is a dev-only debug route
(artifacts/api-server/src/lib/devAuth.ts, GET /api/dev/plan/:plan) — there is no
legitimate way for a real customer to become a paying customer.

Your job: wire up real Stripe billing end to end.

CONTEXT ON EXISTING PATTERNS TO FOLLOW:
- artifacts/api-server/src/routes/webhooks.ts already implements a complete,
  well-structured webhook handler for Mux (video processing) with HMAC signature
  verification — study this file's structure and error handling before building
  the Stripe webhook handler; match its conventions.
- artifacts/api-server/src/routes/share.ts:38-45 has the one existing plan-gate
  in the codebase (blocks free-plan users from enabling share/embed). Use this
  as the pattern for any additional entitlement checks you add.
- lib/db/src/schema/users.ts:23-25 has a `plan: text("plan").notNull().default("free")`
  column but NO stripeCustomerId/stripeSubscriptionId columns yet.
- Session auth is solid and working (express-session + connect-pg-simple,
  requireAuth middleware in artifacts/api-server/src/lib/auth.ts) — build on top
  of it, don't touch it.

SCOPE:
1. Add `stripe` npm dependency to artifacts/api-server/package.json.
2. Add migration: `stripeCustomerId` (text, nullable, unique) and
   `stripeSubscriptionId` (text, nullable) columns to lib/db/src/schema/users.ts,
   plus a `subscriptionStatus` (text, nullable — e.g. active/past_due/canceled)
   and `currentPeriodEnd` (timestamp, nullable) column. Generate and apply the
   Drizzle migration.
3. Create Stripe Products + recurring Prices for Creator ($19/mo), Studio
   ($45/mo), and Team ($79/mo) via the Stripe dashboard or a one-time setup
   script — Free needs no Stripe object, Enterprise stays "contact us" (no
   checkout). Store the resulting Price IDs in environment variables
   (STRIPE_PRICE_CREATOR, STRIPE_PRICE_STUDIO, STRIPE_PRICE_TEAM).
4. Build `POST /api/billing/checkout-session` (new route file
   artifacts/api-server/src/routes/billing.ts, registered in
   artifacts/api-server/src/routes/index.ts) — requireAuth, accepts a plan
   name, creates or reuses a Stripe customer for the logged-in user, creates a
   Checkout Session in subscription mode, returns the session URL.
5. Update artifacts/chroma/src/pages/pricing.tsx so each paid tier's "Choose
   Plan" button (currently ctaHref="/sign-up" at lines ~33,53,72,90) calls the
   new checkout-session endpoint (if logged in) or routes to /sign-up?plan=X
   (if logged out, then resumes checkout after signup) instead of a dead link.
6. Build `POST /api/billing/portal-session` — requireAuth, creates a
   Stripe Billing Portal session for the current user's stripeCustomerId,
   returns the portal URL. Add a "Manage subscription" link somewhere
   reachable from account settings (check artifacts/chroma/src/pages for the
   existing account/security page pattern, e.g. storage-confidence.tsx, and
   add a peer page or section).
7. Build `POST /api/webhooks/stripe` in artifacts/api-server/src/routes/webhooks.ts
   (new handler alongside the existing Mux one) — verify Stripe's webhook
   signature, handle at minimum: checkout.session.completed (set plan +
   stripeSubscriptionId + subscriptionStatus on the user),
   customer.subscription.updated (sync subscriptionStatus + currentPeriodEnd,
   and downgrade `plan` to "free" if status becomes canceled/unpaid),
   customer.subscription.deleted (set plan back to "free").
8. Do NOT remove the devAuth.ts dev-only plan toggle, but make sure it's only
   reachable when NODE_ENV === "development" (check app.ts for how devAuth
   routes are currently gated and confirm this route follows the same gate).

ACCEPTANCE CRITERIA:
- A logged-in free-plan user can click "Choose Plan" on Creator/Studio/Team,
  complete a real Stripe test-mode checkout, and land back on the app with
  their `plan` column updated to match — verify by hitting GET /api/users/me
  after checkout completes.
- Canceling a subscription via the Stripe customer portal correctly downgrades
  the user's `plan` back to "free" within one webhook round-trip (test by
  triggering a test webhook event via the Stripe CLI, e.g.
  `stripe trigger customer.subscription.deleted`).
- The share/embed plan-gate at routes/share.ts:38-45 correctly unblocks once a
  user's plan is upgraded via this new flow (no changes needed to that file,
  just confirm it works given the new plan-write path).
- Add integration tests covering: checkout-session creation, the Stripe
  webhook handler for all three event types above (mock Stripe signatures),
  and the portal-session route. There is currently ZERO backend test coverage
  in this repo (only one Playwright e2e nav-smoke spec exists) — don't skip
  this, billing is the highest-risk surface to ship untested.
- Do not log or persist raw card data anywhere — Stripe Checkout/Portal are
  hosted, so this should be a non-issue if you don't deviate from the
  Checkout Session / Billing Portal APIs.

OUT OF SCOPE: proration logic beyond Stripe's defaults, annual billing,
usage-based/metered billing, Enterprise self-serve checkout, invoice PDF
customization. Keep it to: 3 paid tiers, monthly, Stripe-hosted Checkout +
Portal, webhook-driven plan sync.
```

---

## Prompt 2: Frame-Accurate Timestamped Commenting

```
Chroma is a filmmaker client-review platform (React/Vite/TS frontend in
artifacts/chroma, Express backend in artifacts/api-server, Postgres/Drizzle
schema in lib/db). Its core differentiator is frame-accurate review commenting,
and a user survey (n=6) ranked "timestamped & frame-accurate comments" as the
2nd-most-requested feature overall. The data layer already supports this
correctly, but the frontend does not: today, a reviewer types a raw number of
seconds into a plain <input type="number"> field instead of the comment being
tied to wherever they actually paused/clicked on the video player. Your job is
to close that gap.

CURRENT STATE (read these before starting):
- lib/db/src/schema/videos.ts — reviewCommentsTable has a required
  `timecodeSeconds` (real/float) column already, and comments are correctly
  sorted by it.
- artifacts/api-server/src/routes/review.ts — comment posting endpoints
  (owner path around lines 293-333, guest/anonymous path around lines
  452-488) accept timecodeSeconds as-is from the client; no backend changes
  should be needed for the core capture, but read this file fully before
  assuming that.
- artifacts/chroma/src/pages/review-page.tsx — this is the file to change.
  Around lines 257-333 it renders the comment list and comment-composer form;
  around lines 300-313 there's currently a manual `<input type="number">`
  labeled "Timecode (seconds)" that the reviewer fills in by hand. Find and
  read the surrounding component to understand how the video player is
  currently rendered on this page (it uses either @mux/mux-player-react or
  Cloudflare's @cloudflare/stream-react <Stream> component depending on which
  provider processed the video — check video-detail.tsx for the pattern this
  page likely mirrors, since both pages render a review/detail view of a
  video).

SCOPE:
1. Get a ref/handle to the active video player component in review-page.tsx
   (Mux player or Cloudflare Stream player, whichever is in use for a given
   video's provider) so you can read its current playback position on demand.
   Both player libraries expose a currentTime property/ref — find the correct
   API for whichever is already imported in this codebase (check
   video-detail.tsx and package.json for @mux/mux-player-react and
   @cloudflare/stream-react to confirm which APIs are available).
2. When a reviewer opens the comment composer (or clicks an explicit "Add
   comment at current time" affordance), capture the player's live
   currentTime and use it as the default/primary timecodeSeconds value sent
   to the backend — replacing manual entry as the primary path.
3. Keep a way to manually adjust/override the captured timecode (e.g. a small
   editable field pre-filled with the captured value) rather than removing
   manual entry entirely — reviewers should be able to fine-tune, not be
   forced to accept whatever the player reports.
4. Add click-to-seek: clicking an existing comment in the comment list (in
   the ~257-333 region of review-page.tsx) should seek the player to that
   comment's timecodeSeconds and (ideally) pause there.
5. Apply the same change to BOTH the authenticated-owner comment flow and the
   guest/anonymous review-link flow (routes/review.ts:452-488 backend, and
   whatever frontend component renders the guest view — check if it's the
   same review-page.tsx or a separate component; the routes file suggests
   guests hit a different endpoint but the review page may be shared).
6. Verify timecodeSeconds precision is adequate: it's currently a `real`
   (float) column. At typical broadcast frame rates (23.976–60fps), confirm
   the frontend isn't rounding to whole seconds anywhere in the capture path
   — frame accuracy at 30fps requires ~0.033s precision, which a float
   column supports fine, but check the capture code doesn't accidentally
   Math.round() or parseInt() the value anywhere.

ACCEPTANCE CRITERIA:
- Playing a video, pausing at an arbitrary non-whole-second point, and
  clicking "add comment" produces a comment whose stored timecodeSeconds
  matches the player's paused position (not a rounded/typed value), verified
  by checking the value sent in the network request and/or the DB row.
- Clicking a comment in the list seeks the player to within ~1 frame of that
  comment's timecode.
- This works identically for both a logged-in owner reviewing their own
  video and an anonymous guest using a shared review link.
- Existing comments with manually-typed timecodes from before this change
  still display and sort correctly (no migration needed — same column,
  just a better-populated value going forward).
- No regressions to the existing resolve/approve flows in review-page.tsx.

OUT OF SCOPE: waveform/scrubber visualization of comment markers on the
timeline (nice future enhancement, not required here), drawing/annotation
tools on top of the frame, real frame-number (vs. timecode-in-seconds)
display — seconds-based storage is fine, just make sure it's captured from
the actual player position rather than typed.
```

---

## Prompt 3: Version Comparison Frontend

```
Chroma is a filmmaker client-review platform (React/Vite/TS frontend in
artifacts/chroma, Express backend in artifacts/api-server, Postgres/Drizzle
schema in lib/db). "Version history" for client review (uploading a revised
cut and letting the client see/compare it against the prior version) is named
as a core requirement in the product PRD, but today it's pure backend
scaffolding with ZERO frontend usage — every video upload becomes its own
isolated, unreachable "version 1" in practice, even though the schema and API
already support linking uploads into version groups. Your job is to build the
missing frontend so this capability is actually usable.

CURRENT STATE (read these before starting):
- lib/db/src/schema/videos.ts — videosTable has `versionNumber` (integer,
  around line 40) and `reviewGroupId` (text, around line 39) columns.
- artifacts/api-server/src/routes/videos.ts — POST /videos (around lines
  201-217) already increments versionNumber correctly when the client passes
  an existing reviewGroupId in the request; if no reviewGroupId is passed, it
  mints a new one (`edit-${randomUUID()}`), meaning every current upload
  starts a brand-new, unrelated group.
- artifacts/api-server/src/routes/review.ts — getLatestVideo (around lines
  68-97) resolves a review link to the single latest video by
  `desc(versionNumber)` within a reviewGroupId — this means once you start
  sending real reviewGroupIds, review links will automatically show the
  newest version without further backend changes. Confirm this behavior by
  reading the function fully.
- artifacts/chroma/src/pages/video-upload.tsx — the upload flow. Currently
  NEVER sends a reviewGroupId in its POST /videos call (confirmed via
  repo-wide grep — zero frontend references to reviewGroupId outside mock
  data in artifacts/chroma/src/mocks/data.ts). This is the file to change for
  the upload side.
- artifacts/chroma/src/pages/review-page.tsx and video-detail.tsx — these
  need a version picker/switcher added; currently they only ever render the
  single video resolved by getLatestVideo or a direct video ID with no
  awareness that other versions might exist.

SCOPE:
1. Add a `GET /videos/group/:reviewGroupId` (or similar) backend endpoint in
   routes/videos.ts that returns all videos in a reviewGroupId ordered by
   versionNumber, so the frontend can list every version. Reuse existing
   auth/ownership checks from nearby routes in this file.
2. Update video-upload.tsx: when a user uploads a new cut as a revision of an
   existing video (not a brand-new project), let them select/attach it to
   that video's existing reviewGroupId instead of always starting a new one.
   Figure out the right UX entry point — likely from video-detail.tsx or
   library.tsx via an explicit "Upload new version" action on an existing
   video, which then passes that video's reviewGroupId through to the upload
   flow.
3. Add a version picker (dropdown, tabs, or a simple numbered list — match
   the existing UI component patterns in artifacts/chroma/src/components/ui)
   to both video-detail.tsx and review-page.tsx, using the new
   GET /videos/group/:reviewGroupId endpoint, so a viewer can switch between
   versions of the same edit.
4. On review-page.tsx specifically, add a basic version-compare affordance:
   at minimum, let the reviewer switch the player between "current" and
   "previous" version to A/B by eye. A true side-by-side dual-player view is
   a stretch goal if time allows, but a fast single-player switch is the
   minimum bar — don't let scope on the compare UI block shipping the
   version-listing/switching capability itself.
5. Decide and implement how comments/approval status behave across versions:
   check whether reviewCommentsTable and the approvalStatus fields on
   videosTable are scoped per-video-row or need to be understood as
   per-reviewGroupId — today, since getLatestVideo always resolves to the
   newest version, confirm whether comments left on version 1 remain visible
   when version 2 is uploaded, or effectively "disappear" because the review
   link now points elsewhere. Make this behavior explicit and visible in the
   UI (e.g. "3 comments on this version" scoped correctly) rather than
   leaving it ambiguous.

ACCEPTANCE CRITERIA:
- Uploading a revised cut from an existing video's detail page correctly
  increments versionNumber under the same reviewGroupId (verify via DB or
  the new group-listing endpoint), rather than starting an unrelated group.
- A reviewer opening a review link sees a clear indicator of which version
  they're viewing and can switch to see prior versions.
- Comments and approval state are not silently lost or misattributed when
  switching between versions — whatever scoping decision is made in step 5
  is reflected correctly in what the UI shows per version.
- Existing single-version videos (the common case today, since this feature
  was previously unused) continue to work with no visible change — the
  version picker should not appear/should be trivial for reviewGroups with
  only one video in them.

OUT OF SCOPE: frame-by-frame visual diffing, automatic detection of which
version a comment "still applies to," true synchronized side-by-side
dual-player scrubbing (single-player switch is the accepted minimum bar per
step 4).
```

---

**Note:** these three prompts assume a Devin-style agent will explore the repo itself to confirm exact line numbers before editing — line references above are from the audit pass and may have shifted slightly if other changes land first. Re-verify against the working tree at execution time.
