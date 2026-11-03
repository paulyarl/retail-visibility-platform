#!/usr/bin/env sh
# Vercel "Ignored Build Step" — skip the deployment when nothing relevant changed.
#
# Exit 0 -> deployment canceled (skip). Exit non-zero -> build proceeds.
# Runs with cwd = project rootDirectory (apps/web), so all paths are anchored
# to the repo toplevel. Fails OPEN (exit 1 = build) whenever a diff base can't
# be resolved — an unknown base must never cancel a build.
#
# Base: prefer VERCEL_GIT_PREVIOUS_SHA (last deployed commit — correct for
# multi-commit pushes), but only when the object exists in the (possibly
# shallow) clone; otherwise fall back to HEAD^.

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$ROOT" || exit 1

BASE=""
if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null; then
  BASE="$VERCEL_GIT_PREVIOUS_SHA"
elif git rev-parse -q --verify "HEAD^" >/dev/null 2>&1; then
  BASE="HEAD^"
else
  exit 1  # no resolvable base — build
fi

git diff "$BASE" HEAD --quiet -- \
  apps/web \
  packages/shared \
  shared \
  pnpm-lock.yaml \
  pnpm-workspace.yaml \
  vercel.json
