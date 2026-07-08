#!/bin/bash
# Sets up automatic GitHub sync: installs the post-commit hook and configures
# the git credential helper to use $GITHUB_TOKEN.
# Safe to run multiple times (idempotent).
set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"

# 1. Configure credential helper to use GITHUB_TOKEN env var
git config credential.helper '!f() { echo "username=x-token"; echo "password=${GITHUB_TOKEN}"; }; f'

# 2. Ensure GitHub origin remote exists
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$ORIGIN_URL" ]; then
  git remote add origin https://github.com/ryanborroff/ChromaStudio.git
  echo "[github-sync] Added origin remote → https://github.com/ryanborroff/ChromaStudio.git"
else
  echo "[github-sync] Origin already set: $ORIGIN_URL"
fi

# 3. Install post-commit hook from the committed source
HOOK_SRC="$REPO_ROOT/scripts/git-hooks/post-commit"
HOOK_DEST="$REPO_ROOT/.git/hooks/post-commit"

cp "$HOOK_SRC" "$HOOK_DEST"
chmod +x "$HOOK_DEST"
echo "[github-sync] post-commit hook installed"
