#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
pnpm run typecheck

# Reinstall git hooks and credential config after every merge
bash scripts/setup-github-sync.sh
