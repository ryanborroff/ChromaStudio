# Stage B checkpoint — 10 October 2026

Stage B is **not complete**. Stage C has not been started.

## Changes in this checkpoint

- Browser SHA-256 runs in a separate worker using slices no larger than 8 MiB, including resumed originals. `@noble/hashes` is pinned to 2.0.1. Large originals register without a synchronous checksum read, then submit their expected digest to the owner-scoped verification queue. The UI reports hashing, uploading and queue submission separately.
- Direct Warehouse PUT URLs sign `If-None-Match: *`, and the client sends the condition. This prevents replay overwrites when enforced by R2. Other existing upload callers retain their prior behavior. Live enforcement and CORS remain acceptance gates.
- Verification retries wait exponentially (two minutes after attempt one, four after attempt two). Each job has a six-hour network/stream budget; terminal retry failures record their completion time. Existing atomic claims, ownership checks and transactional checksum commits remain.
- Added a 33 MiB bounded-slice checksum comparison against Node SHA-256, a signed-condition/ACL regression, and mismatch/truncated-stream worker regressions.

## Evidence

- Inspected the initially empty local repository before fetching and checking out `feature/stage-b-media-warehouse`. The starting head matched `dff8a384abc0f63b382f094a05bf38ac3d8cd2c2`. No unrelated local work was present. No `AGENTS.md` was found.
- At that starting head, both GitHub CI checks and both Semgrep checks passed. The separate `Workers Builds: chromastudio` check failed. It has not been diagnosed or repaired in this checkpoint.
- Took a read-only PostgreSQL dump over Railway SSH. Restored it into an isolated local PostgreSQL 16 instance. The source is PostgreSQL 18; the restore copy omits only `SET transaction_timeout = 0`, which PostgreSQL 16 does not support. The original dump remains intact in a private temporary file.
- Migration runner default rehearsal rolled back and preserved row counts for all 19 existing tables. Apply on the copy preserved those 19 counts. Repeat apply preserved counts for all 21 tables, confirming repeatability. This checks row counts, not equivalence of every cell or production behavior.
- Local workspace typechecks and production builds passed, as did 40 API regression tests across seven files. The separately bundled verification worker imported without executing work.

The temporary database dump contains application data and is not committed. Its temporary location is not a durable recovery guarantee. Retake a backup and verify recovery before any live migration.

## Railway and access state

Inspected project `chroma-studio`, production environment (the authorized prototype), service `api-server`. It still points at `main`; the latest observed deployment was successful from 19 August. No R2 variables were configured. The user chose to return to credential setup later.

No Stage B Railway deployment, live migration, worker scheduling or live R2 integration test was executed. Existing application data has not been changed.

## Outstanding release gates

- Configure the four R2 variables directly in Railway; verify a private bucket, bucket-scoped credentials, CORS including `If-None-Match` and exposed `ETag`, and abandoned multipart lifecycle expiry.
- Finish durable storage quota/reservation enforcement and verification queue resource limits. Validate multipart immutability and completion recovery; the signed direct-PUT condition alone does not establish the whole system's immutability.
- Deploy and schedule the worker with a controlled concurrency and budget; validate timeouts, crash recovery, exhausted retries and operational monitoring against the real database and R2.
- Test realistic large originals, direct upload replay rejection, multipart resume/retry/abort, metadata, byte integrity and original downloads against R2. Camera formats, audio, project files, documents and archives remain in scope.
- Test live cross-account list/read/attach/delete/download denial, upload-once reuse, guest review access, distribution behavior, legacy fallback and original retention when presentations are removed.
- Inspect any application schema drift beyond these two additive migrations; rehearse required additions against a fresh copy. Recheck existing login and project functionality after deploying the tested commit.
- Verify new-head CI/security checks and investigate the failed Cloudflare Workers build. Do not declare Stage B complete with any required acceptance tests outstanding.

The user's explicit authorization permits deploying this existing Railway prototype and supersedes older documentation's deployment restriction. It does not authorize database resets or destructive synchronization.
