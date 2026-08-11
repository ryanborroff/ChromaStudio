#!/bin/bash
set -e
pnpm install --frozen-lockfile
psql $DATABASE_URL -c 'SELECT 1' 2>/dev/null || true
pnpm --filter @workspace/db run push
pnpm run typecheck

# Reinstall git hooks and credential config after every merge
bash scripts/setup-github-sync.sh
