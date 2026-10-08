# Stage A: security verification checklist

This branch introduces ownership checks for delivery files, owner metadata for new signed uploads, authentication throttling, and initial ACL regression tests.

## Before merge
- Run pnpm install --frozen-lockfile
- Run pnpm run typecheck
- Run pnpm --filter @workspace/api-server test
- Verify delivery attachment and download with two test users.
- Verify valid and invalid review links, passwords, expiry and revocation.
- Verify session and authentication controls in staging.
- Confirm all object upload flows assign correct ownership.
- Verify backup and restore procedures.

## Compatibility and rollout
Legacy uploaded files may not have owner ACL metadata. These files will be rejected by the new delivery access checks until their ownership is reconciled and metadata backfilled from trusted records. Inventory these records, back up data, and test the migration in staging before deployment.

The initial authentication limiter is per process, not shared across replicas. Replace it with a shared limiter before a scaled production rollout.

The implementation is not a completed security audit. Do not merge or deploy without tests, compatibility review and staging verification.
