---
name: clerk/shared broken peerless copy breaks api-server build
description: Why `pnpm add` can suddenly break the api-server esbuild build with "Could not resolve @clerk/shared/keys"
---

Running `pnpm add <pkg>` in any workspace package can relink `artifacts/api-server/node_modules/@clerk/shared` to the **peerless** pnpm store copy (`.pnpm/@clerk+shared@<v>/...`, no `_react...` suffix), which can be an empty/incomplete directory (no `package.json`, no `dist/runtime/keys.*`). The api-server bundles CJS via esbuild and imports `publishableKeyFromHost` from `@clerk/shared/keys` (resolved through the `./*` export → `dist/runtime/keys`). When linked to the broken copy the build fails with `Could not resolve "@clerk/shared/keys"` and the workflow won't start.

**Why:** the dev server only fails on a *fresh build/restart*; a previously-running server keeps serving its old bundle, so the breakage stays hidden until the next restart.

**How to apply:** if api-server fails to build on `@clerk/shared/keys` (or similar subpath) after any dependency change, run `pnpm install` at the root to repair the symlink (it should point to the `_react-dom..._react...` suffixed copy that actually contains `dist/runtime/keys.js`), then restart the workflow. Do not "fix" it by editing the import in `app.ts`.
