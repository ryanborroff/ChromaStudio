# Stage B release-readiness audit — 9 October 2026

**Decision: NO-GO for merge or production deployment.** This is a static repository and GitHub Actions audit, not a live storage/database/browser integration test. No production data, migrations, or deployments were changed.

## Verified automated checks
- Commit `db6c87915b9b280753a08d336d2c609eb579c645`: GitHub Actions CI run 37840129258 **passed**; Semgrep run 37840129194 **passed**.
- CI job steps: dependency installation, typecheck, and existing API security regression tests. Despite the job name “Typecheck & Build”, **no separate production build step is listed**. Do not claim a production bundle was tested.
- pnpm `trustPolicy: no-downgrade` enabled with narrowly pinned exceptions for chokidar@4.0.3, pino@9.14.0, semver@6.3.1. Record as accepted temporary risk and review for removal.

## Release blockers

### P0: Untested database migration
`lib/db/migrations/stage-b-media-assets.sql` adds `media_assets`, indexes and nullable `videos.media_asset_id`. SQL is additive and wrapped in a transaction, but **has not been executed against a non-production database copy**. No confirmed pre-deployment backup, row-count reconciliation, migration rehearsal or recovery exercise. New endpoints require the table, so code must not precede migration.

### P0: No Stage B cross-account integration tests
The PR adds no Stage B-specific test files. Static inspection shows `requireAuth`, owner predicates and object ACL checks on asset operations, but these do not replace executable tests. Test unauthenticated, second-user, deleted, revoked-ACL, missing-object, duplicate registration, concurrent attach, and legacy-video cases.

### P0: Private playback unverified
`/api/storage/objects/*` uses an authenticated, owner-only redirect with **attachment** disposition. The review route provides separately authorised short-lived guest playback URLs, but owner playback, seeking, refresh on expiry, downloads and browser handling of MOV and other source formats have not been exercised. Verify the actual rendered video player and review page before shipping.

### P1: Incorrect original metadata
`artifacts/api-server/src/routes/videos.ts` registers completed originals with `originalFilename: video.title || "video-" + video.id` and hard-coded `contentType: "video/mp4"`. This does not preserve the uploaded filename/MIME type, particularly for MOV. Capture trusted upload metadata or verify against object metadata before declaring original preservation.

### P1: Warehouse list is capped without pagination
`GET /media-assets` returns at most 100 entries, and UI search filters only the fetched page. Users with more than 100 originals cannot locate older files. Add cursor pagination and server-side search, or explicitly scope the release as limited beta.

### P1: Feature completion below stated acceptance criteria
The Stage B design calls for reuse in both review **and distribution**, verified guest review and publishing/embeds, inventory/reconciliation, and safe lifecycle. These are not yet demonstrated end to end. “Create private video” is implemented, but public distribution of private originals must not be enabled by changing object ACLs.

### P1: UI/route verification
The warehouse's create-video action navigates to `/videos/:id`; verify that this route exists and renders the intended private video view. The eligible-video dropdown uses public API fields only; the server has stronger checks for empty originals, so a stale candidate may produce a 409. Validate the UX.

## Required release gate
1. Add and run Stage B API integration tests with two users and a real test database/storage fixture or faithful isolated equivalent.
2. Rehearse migration on a restored non-production database snapshot; check pre/post row counts, FK/indexes, legacy video reads, and documented backup/recovery.
3. Exercise upload → verify → warehouse → create/attach → owner playback → guest review playback → download; check MOV/MP4, expiration, deletion and cross-account denial.
4. Correct filename/MIME preservation; decide whether >100-asset pagination is a beta blocker.
5. Run a production bundle build, API tests, CI and Semgrep on the final commit; record evidence.
6. Only then request approval to merge PR #37. Apply the migration before application rollout, and perform post-deploy smoke tests with rollback plan.

**Deployment status:** PR #37 remains draft, unmerged. No Railway deployment or database migration performed by this audit.
