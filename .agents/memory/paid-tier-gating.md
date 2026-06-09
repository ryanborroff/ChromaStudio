---
name: Paid-tier gating
description: How paid-only features are modeled and gated in Chroma (users.plan), and why the User.plan API field is optional.
---

# Paid-tier (plan) gating

Chroma has a single `users.plan` text column (default `"free"`). Anything other than
`"free"` (e.g. `"creator"`, `"studio"`) counts as paid: `isPaid = (plan ?? "free") !== "free"`.

**Gate paid features at the server boundary**, not just in the UI. Example: video
sharing/embedding is gated in the share route — a free user enabling a share link gets
403, before any token is minted. When adding a new paid feature, add the same
`plan !== "free"` check on the write route that creates/enables it. Frontend upgrade
prompts are UX only and are not the enforcement.

**Why `plan` is OPTIONAL in the OpenAPI `User` schema:** `User` is reused in many
responses (Video.user, feed, lists) whose serializers may not include `plan`. Making it
required would make those `.parse()` calls fail. Keep it optional and treat
missing/undefined as `"free"` everywhere. Never do `user.plan !== "free"` on a possibly-
undefined plan to decide *paid* — undefined would read as paid. Always `(plan ?? "free")`.

**Dev preview:** `GET /api/dev/plan/:plan` (whitelist free/creator/studio, dev-only,
sibling of `/api/dev/login|logout`) flips the current account's plan so you can preview
free vs paid states. The dev auto-login demo user starts as `free`.

**Known gap (intentional, not implemented):** downgrading from paid to free does NOT
disable existing share links — public `/share/:token` doesn't recheck the owner's current
plan. Revisit if "paid-only" must revoke access on downgrade.
