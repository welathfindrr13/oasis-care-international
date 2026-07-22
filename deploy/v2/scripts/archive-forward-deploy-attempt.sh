#!/usr/bin/env bash
set -euo pipefail

EXPECTED_USER=deploy
EXPECTED_REPOSITORY_ROOT=/opt/oasis-care
EXPECTED_ATTEMPT_ID=e8db1facbaa5b7e9d45b1994af3211d0
EXPECTED_TARGET_SHA=18aacd8458a3f96a38bf470d9a4c837ad563fa5c
EXPECTED_REVIEW_BASE_SHA=0d7b8472535220d56efeb56512449cbfcc884ee7
EXPECTED_REPOSITORY=welathfindrr13/oasis-care-international
EXPECTED_LEGACY_TARGET_SHA=72b34c2b2a1b959f7ac1db442afcbe9f9a65f07c
EXPECTED_APP_URL=https://app.oasiscare.care
PRODUCTION_MARKER=/etc/oasis/production-deploy-target-class
ROTATION_TOOL_SHA="${ROTATION_TOOL_SHA:-}"

fail() {
  printf '%s\n' "$1"
  exit 1
}

[ "$(id -un 2>/dev/null)" = "$EXPECTED_USER" ] || fail FORWARD_ARCHIVE_IDENTITY_INVALID
helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P)" || fail FORWARD_ARCHIVE_HELPER_UNSAFE
[[ "$helper_dir" =~ ^/var/tmp/oasis-forward-archive\.[A-Za-z0-9]{8}$ ]] || fail FORWARD_ARCHIVE_HELPER_UNSAFE
[ "$(stat -c '%U:%G:%a' "$helper_dir" 2>/dev/null)" = deploy:deploy:700 ] || fail FORWARD_ARCHIVE_HELPER_UNSAFE

cd "$EXPECTED_REPOSITORY_ROOT" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
[ -d .git ] && [ ! -L .git ] || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
[[ "$ROTATION_TOOL_SHA" =~ ^[0-9a-f]{40}$ ]] || fail FORWARD_ARCHIVE_INPUTS_INVALID
repository_status="$(GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all 2>/dev/null)" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
[ -z "$repository_status" ] || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
unset repository_status
origin_url="$(git remote get-url origin 2>/dev/null)" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
case "$origin_url" in
  https://github.com/welathfindrr13/oasis-care-international.git|git@github.com:welathfindrr13/oasis-care-international.git) ;;
  *) fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE ;;
esac

git_common_raw="$(git rev-parse --git-common-dir 2>/dev/null)" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
git_common="$(cd "$git_common_raw" 2>/dev/null && pwd -P)" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
[ "$git_common" = "$EXPECTED_REPOSITORY_ROOT/.git" ] || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE

deploy_state_root="$git_common/oasis-deploy"
legacy_state_dir="$deploy_state_root/legacy-bootstrap-v1/state"
mutation_lock="$deploy_state_root/production-vps-mutation.lock"
archive_helper="$helper_dir/archive-forward-deploy-attempt.mjs"
forward_helper="$helper_dir/forward-deploy-state.mjs"
legacy_helper="$helper_dir/legacy-bootstrap-state.mjs"
revision_helper="$helper_dir/revision-proof.mjs"

for helper in "$archive_helper" "$forward_helper" "$legacy_helper" "$revision_helper"; do
  [ -f "$helper" ] && [ ! -L "$helper" ] || fail FORWARD_ARCHIVE_HELPER_UNSAFE
  [ "$(stat -c '%U:%G:%a' "$helper" 2>/dev/null)" = deploy:deploy:600 ] || fail FORWARD_ARCHIVE_HELPER_UNSAFE
done

exec 9<>"$mutation_lock"
flock -n 9 || fail FORWARD_ARCHIVE_MUTATION_LOCKED
printf 'FORWARD_ARCHIVE_MUTATION_LOCK_ACQUIRED\n'
[ -r "$PRODUCTION_MARKER" ] && [ ! -L "$PRODUCTION_MARKER" ] || fail FORWARD_ARCHIVE_TARGET_UNSAFE
[ "$(tr -d '\r\n' < "$PRODUCTION_MARKER" 2>/dev/null)" = production ] || fail FORWARD_ARCHIVE_TARGET_UNSAFE
repository_status="$(GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all 2>/dev/null)" || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
[ -z "$repository_status" ] || fail FORWARD_ARCHIVE_REPOSITORY_UNSAFE
unset repository_status
remote_main_line="$(timeout --signal=TERM --kill-after=2s 20s git ls-remote --exit-code origin refs/heads/main 2>/dev/null)" || fail FORWARD_ARCHIVE_TARGET_UNSAFE
remote_main="${remote_main_line%%[[:space:]]*}"
unset remote_main_line
[ "$remote_main" = "$ROTATION_TOOL_SHA" ] || fail FORWARD_ARCHIVE_TARGET_UNSAFE
printf 'FORWARD_ARCHIVE_LOCKED_PREFLIGHT_VALID\n'

compose=(docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml)
declare -A running_images
for service in api web caddy; do
  container_id="$(timeout --signal=TERM --kill-after=2s 10s "${compose[@]}" ps -q "$service" 2>/dev/null)" || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  [[ "$container_id" =~ ^[0-9a-f]{64}$ ]] || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  health="$(timeout --signal=TERM --kill-after=2s 10s docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null)" || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  [ "$health" = healthy ] || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  image_id="$(timeout --signal=TERM --kill-after=2s 10s docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null)" || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
  running_images["$service"]="$image_id"
done

postgres_container="$(timeout --signal=TERM --kill-after=2s 10s "${compose[@]}" ps -q postgres 2>/dev/null)" || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
[[ "$postgres_container" =~ ^[0-9a-f]{64}$ ]] || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
postgres_health="$(timeout --signal=TERM --kill-after=2s 10s docker inspect --format '{{.State.Health.Status}}' "$postgres_container" 2>/dev/null)" || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE
[ "$postgres_health" = healthy ] || fail FORWARD_ARCHIVE_RUNTIME_UNSAFE

if ! timeout --foreground --signal=TERM --kill-after=2s 30s \
  env OASIS_PRODUCTION_APP_URL="$EXPECTED_APP_URL" TARGET_SHA="$EXPECTED_LEGACY_TARGET_SHA" \
  node "$revision_helper" rollback_legacy >/dev/null 2>&1; then
  fail FORWARD_ARCHIVE_REVISION_UNSAFE
fi
printf 'FORWARD_ARCHIVE_LEGACY_RUNTIME_VERIFIED\n'

GIT_COMMON_DIR="$git_common" \
ATTEMPT_ID="$EXPECTED_ATTEMPT_ID" \
TARGET_SHA="$EXPECTED_TARGET_SHA" \
REVIEW_BASE_SHA="$EXPECTED_REVIEW_BASE_SHA" \
REPOSITORY="$EXPECTED_REPOSITORY" \
LEGACY_STATE_DIR="$legacy_state_dir" \
LEGACY_STATE_HELPER="$legacy_helper" \
RUNNING_API_IMAGE_ID="${running_images[api]}" \
RUNNING_WEB_IMAGE_ID="${running_images[web]}" \
RUNNING_CADDY_IMAGE_ID="${running_images[caddy]}" \
MUTATION_LOCK_FD=9 \
node "$archive_helper"
