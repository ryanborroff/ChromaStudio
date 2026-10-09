# Stage B: large-original integrity verification design

Status: **design only, not implemented**. This document defines the next Stage B implementation gate. Do not report large-file checksum verification as available until the worker, database migration, security tests and real R2 exercises pass.

## Problem

The Media Warehouse currently verifies a caller-supplied SHA-256 only for objects up to 32 MiB. Larger originals can be stored and registered, but their content integrity has **not** been independently verified. The current `status = verified` means R2 object existence and metadata were checked, not that its bytes matched a trusted digest.

A synchronous API route must not stream hundreds of gigabytes of camera originals. The browser must not read an entire large file into memory.

## Proposed implementation

1. Compute SHA-256 incrementally in the browser while reading bounded file slices (e.g. 8–32 MiB). Use a streaming/incremental SHA-256 implementation with a pinned, audited dependency, or a dedicated worker; Web Crypto `subtle.digest` alone is not incremental. Never buffer a complete large original.
2. Persist an **expected** digest separately from a **verified** digest. Never display `SHA-256 verified` merely because the browser submitted a hash. Persist the expected size, object key, owner, checksum algorithm and object version/ETag where available.
3. Add a durable verification job table with unique asset/job id, owner, status (`queued`, `running`, `verified`, `mismatch`, `failed`), retry count, lease/heartbeat, progress bytes, timestamps and last error category. Job creation must be authenticated and owner-scoped, rate limited and quota checked.
4. A separately deployed worker claims jobs atomically, rechecks owner/ACL and object metadata, streams R2 bytes through a bounded-memory hash, compares total bytes and expected SHA-256, and records the outcome transactionally. Limit concurrent jobs, bandwidth and total runtime; support retries, cancellation, crash recovery and exponential backoff.
5. Guard against overwrites during verification: prefer immutable object versions or copy the completed upload into a write-once final key before verification. Compare object identity before and after streaming; a matching size and MIME alone cannot prove immutability.
6. The UI must distinguish `Stored (checksum not verified)`, `Verification queued`, `Verifying`, `SHA-256 verified`, `Mismatch` and `Verification failed`. Do not conflate metadata verification with content verification.
7. Provide secure owner-scoped job status endpoints and avoid exposing internal storage keys, digests of other users' files, or infrastructure errors.

## Test and release gates

- Unit tests: digest match/mismatch, truncated stream, modified object identity, empty body, aborted read, transient R2 failures, retry exhaustion, concurrent workers, duplicate requests, cancellation and recovery.
- Security: owner A cannot request, read or cancel owner B's jobs; revoked ACL prevents verification; no unbounded synchronous reads.
- Integration: exercise multipart 100+ GiB simulated/fixture workflow and at least one realistic large camera original against a dedicated non-production R2 bucket; validate CORS, ETag, reselect/retry and object retention.
- Operational: configure lifecycle expiry for abandoned multipart uploads, job concurrency/cost limits, metrics/alerts and runbooks. Verify DB migration, backup and rollback in non-production.
- Release: run API and UI builds, full CI, Semgrep and browser smoke tests. Do not merge or deploy Stage B without explicit approval.

## Known adjacent blocker

The current signed direct PUT may be replayable until expiry and R2 keys may be overwritten. Registration retry checks on size and MIME do **not** detect replacement by equal-size, equal-type bytes. Write-once storage/object identity protection is a prerequisite for a trustworthy verified checksum.
