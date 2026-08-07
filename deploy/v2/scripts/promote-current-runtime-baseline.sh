#!/usr/bin/env bash
set -euo pipefail

EXPECTED_USER=deploy
EXPECTED_REPOSITORY_ROOT=/opt/oasis-care
EXPECTED_CURRENT_SHA=eff14ee1becfafdec4f0bfee54cbcd62170901b3
EXPECTED_NEXT_TARGET_SHA=bcd14c8b5b96764adb778563983d8392357959d4
EXPECTED_REPOSITORY=welathfindrr13/oasis-care-international
EXPECTED_APP_URL=https://app.oasiscare.care
PRODUCTION_MARKER=/etc/oasis/production-deploy-target-class
ROTATION_TOOL_SHA="${ROTATION_TOOL_SHA:-}"
BASELINE_ATTEMPT_ID="${BASELINE_ATTEMPT_ID:-}"
RUNTIME_BASELINE_APPROVAL="${RUNTIME_BASELINE_APPROVAL:-}"

fail() {
  printf '%s\n' "$1"
  exit 1
}

[ "$(id -un 2>/dev/null)" = "$EXPECTED_USER" ] || fail RUNTIME_BASELINE_IDENTITY_INVALID
[[ "$ROTATION_TOOL_SHA" =~ ^[0-9a-f]{40}$ ]] || fail RUNTIME_BASELINE_INPUTS_INVALID
[[ "$BASELINE_ATTEMPT_ID" =~ ^[0-9a-f]{32}$ ]] || fail RUNTIME_BASELINE_INPUTS_INVALID
required_approval="APPROVE_RUNTIME_BASELINE_${EXPECTED_CURRENT_SHA}_TO_${EXPECTED_NEXT_TARGET_SHA}_WITH_${ROTATION_TOOL_SHA}_ATTEMPT_${BASELINE_ATTEMPT_ID}_FROM_COMPLETE"
[ "$RUNTIME_BASELINE_APPROVAL" = "$required_approval" ] ||
  fail RUNTIME_BASELINE_APPROVAL_INVALID
unset required_approval RUNTIME_BASELINE_APPROVAL

helper_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd -P)" ||
  fail RUNTIME_BASELINE_HELPER_UNSAFE
[[ "$helper_dir" =~ ^/var/tmp/oasis-runtime-baseline\.[A-Za-z0-9]{8}$ ]] ||
  fail RUNTIME_BASELINE_HELPER_UNSAFE
[ "$(stat -c '%U:%G:%a' "$helper_dir" 2>/dev/null)" = deploy:deploy:700 ] ||
  fail RUNTIME_BASELINE_HELPER_UNSAFE

cd "$EXPECTED_REPOSITORY_ROOT" || fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
[ -d .git ] && [ ! -L .git ] || fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
repository_status="$(GIT_OPTIONAL_LOCKS=0 git status --porcelain --untracked-files=all 2>/dev/null)" ||
  fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
[ -z "$repository_status" ] || fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
unset repository_status
[ "$(git rev-parse HEAD 2>/dev/null)" = "$EXPECTED_CURRENT_SHA" ] ||
  fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
origin_url="$(git remote get-url origin 2>/dev/null)" || fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
case "$origin_url" in
  https://github.com/welathfindrr13/oasis-care-international.git | git@github.com:welathfindrr13/oasis-care-international.git) ;;
  *) fail RUNTIME_BASELINE_REPOSITORY_UNSAFE ;;
esac

git_common_raw="$(git rev-parse --git-common-dir 2>/dev/null)" ||
  fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
git_common="$(cd "$git_common_raw" 2>/dev/null && pwd -P)" ||
  fail RUNTIME_BASELINE_REPOSITORY_UNSAFE
[ "$git_common" = "$EXPECTED_REPOSITORY_ROOT/.git" ] ||
  fail RUNTIME_BASELINE_REPOSITORY_UNSAFE

deploy_state_root="$git_common/oasis-deploy"
mutation_lock="$deploy_state_root/production-vps-mutation.lock"
promotion_helper="$helper_dir/promote-current-runtime-baseline.mjs"
promotion_wrapper="$helper_dir/promote-current-runtime-baseline.sh"
forward_helper="$helper_dir/forward-deploy-state.mjs"
legacy_helper="$helper_dir/legacy-bootstrap-state.mjs"
revision_helper="$helper_dir/revision-proof.mjs"
preflight_helper="$helper_dir/preflight-env.mjs"

declare -A helper_repository_paths=(
  ["$promotion_wrapper"]="deploy/v2/scripts/promote-current-runtime-baseline.sh"
  ["$promotion_helper"]="deploy/v2/scripts/promote-current-runtime-baseline.mjs"
  ["$forward_helper"]="deploy/v2/scripts/forward-deploy-state.mjs"
  ["$legacy_helper"]="deploy/v2/scripts/legacy-bootstrap-state.mjs"
  ["$revision_helper"]=".github/workflows/revision-proof.mjs"
  ["$preflight_helper"]="deploy/v2/scripts/preflight-env.mjs"
)
declare -A helper_modes=(
  ["$promotion_wrapper"]="deploy:deploy:700"
  ["$promotion_helper"]="deploy:deploy:600"
  ["$forward_helper"]="deploy:deploy:600"
  ["$legacy_helper"]="deploy:deploy:600"
  ["$revision_helper"]="deploy:deploy:600"
  ["$preflight_helper"]="deploy:deploy:600"
)

shopt -s dotglob nullglob
helper_entries=("$helper_dir"/*)
shopt -u dotglob nullglob
[ "${#helper_entries[@]}" -eq "${#helper_repository_paths[@]}" ] ||
  fail RUNTIME_BASELINE_HELPER_UNSAFE
for helper in "${helper_entries[@]}"; do
  [ -n "${helper_repository_paths[$helper]+present}" ] || fail RUNTIME_BASELINE_HELPER_UNSAFE
done
for helper in "${!helper_repository_paths[@]}"; do
  [ -f "$helper" ] && [ ! -L "$helper" ] || fail RUNTIME_BASELINE_HELPER_UNSAFE
  [ "$(stat -c '%U:%G:%a' "$helper" 2>/dev/null)" = "${helper_modes[$helper]}" ] ||
    fail RUNTIME_BASELINE_HELPER_UNSAFE
done
[ "$helper_dir/$(basename "${BASH_SOURCE[0]}")" = "$promotion_wrapper" ] ||
  fail RUNTIME_BASELINE_HELPER_UNSAFE

verify_helper_bundle() {
  local helper repository_path expected_object actual_object object_type
  for helper in "${!helper_repository_paths[@]}"; do
    repository_path="${helper_repository_paths[$helper]}"
    expected_object="$(git rev-parse --verify "$ROTATION_TOOL_SHA:$repository_path" 2>/dev/null)" ||
      fail RUNTIME_BASELINE_HELPER_UNSAFE
    [[ "$expected_object" =~ ^[0-9a-f]{40,64}$ ]] || fail RUNTIME_BASELINE_HELPER_UNSAFE
    object_type="$(git cat-file -t "$expected_object" 2>/dev/null)" ||
      fail RUNTIME_BASELINE_HELPER_UNSAFE
    [ "$object_type" = blob ] || fail RUNTIME_BASELINE_HELPER_UNSAFE
    actual_object="$(git hash-object --no-filters "$helper" 2>/dev/null)" ||
      fail RUNTIME_BASELINE_HELPER_UNSAFE
    [ "$actual_object" = "$expected_object" ] || fail RUNTIME_BASELINE_HELPER_UNSAFE
  done
}

exec 9<>"$mutation_lock"
flock -n 9 || fail RUNTIME_BASELINE_MUTATION_LOCKED
printf 'RUNTIME_BASELINE_MUTATION_LOCK_ACQUIRED\n'

[ -r "$PRODUCTION_MARKER" ] && [ ! -L "$PRODUCTION_MARKER" ] ||
  fail RUNTIME_BASELINE_TARGET_UNSAFE
[ "$(tr -d '\r\n' <"$PRODUCTION_MARKER" 2>/dev/null)" = production ] ||
  fail RUNTIME_BASELINE_TARGET_UNSAFE
remote_main_line="$(
  timeout --signal=TERM --kill-after=2s 20s \
    git ls-remote --exit-code origin refs/heads/main 2>/dev/null
)" || fail RUNTIME_BASELINE_TARGET_UNSAFE
remote_main="${remote_main_line%%[[:space:]]*}"
unset remote_main_line
[ "$remote_main" = "$ROTATION_TOOL_SHA" ] || fail RUNTIME_BASELINE_TARGET_UNSAFE
git cat-file -e "$ROTATION_TOOL_SHA^{commit}" 2>/dev/null ||
  fail RUNTIME_BASELINE_TOOLING_UNREADABLE
git merge-base --is-ancestor "$EXPECTED_NEXT_TARGET_SHA" "$ROTATION_TOOL_SHA" 2>/dev/null ||
  fail RUNTIME_BASELINE_TARGET_UNSAFE
verify_helper_bundle

node "$preflight_helper" deploy/v2/.env >/dev/null 2>&1 ||
  fail RUNTIME_BASELINE_ENVIRONMENT_UNSAFE
compose=(docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml)
declare -A running_images
for service in api web caddy; do
  container_id="$(
    timeout --signal=TERM --kill-after=2s 10s "${compose[@]}" ps -q "$service" 2>/dev/null
  )" || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  [[ "$container_id" =~ ^[0-9a-f]{64}$ ]] || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  health="$(
    timeout --signal=TERM --kill-after=2s 10s \
      docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "$container_id" 2>/dev/null
  )" || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  [ "$health" = healthy ] || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  image_id="$(
    timeout --signal=TERM --kill-after=2s 10s \
      docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null
  )" || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  [[ "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]] || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
  running_images["$service"]="$image_id"
done

postgres_container="$(
  timeout --signal=TERM --kill-after=2s 10s "${compose[@]}" ps -q postgres 2>/dev/null
)" || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
[[ "$postgres_container" =~ ^[0-9a-f]{64}$ ]] || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
postgres_health="$(
  timeout --signal=TERM --kill-after=2s 10s \
    docker inspect --format '{{.State.Health.Status}}' "$postgres_container" 2>/dev/null
)" || fail RUNTIME_BASELINE_RUNTIME_UNSAFE
[ "$postgres_health" = healthy ] || fail RUNTIME_BASELINE_RUNTIME_UNSAFE

timeout --foreground --signal=TERM --kill-after=2s 30s \
  env OASIS_PRODUCTION_APP_URL="$EXPECTED_APP_URL" TARGET_SHA="$EXPECTED_CURRENT_SHA" \
  node "$revision_helper" target_exact >/dev/null 2>&1 ||
  fail RUNTIME_BASELINE_REVISION_UNSAFE
verify_helper_bundle
printf 'RUNTIME_BASELINE_LOCKED_PREFLIGHT_VALID\n'

promotion_started=0
recover_on_exit() {
  local original_status="$1"
  trap - EXIT HUP INT TERM
  if [ "$promotion_started" -eq 1 ]; then
    if ! GIT_COMMON_DIR="$git_common" \
      BASELINE_ATTEMPT_ID="$BASELINE_ATTEMPT_ID" \
      MUTATION_LOCK_FD=9 \
      node "$promotion_helper" recover >/dev/null 2>&1; then
      printf 'RUNTIME_BASELINE_RECOVERY_REQUIRED\n'
    fi
  fi
  exit "$original_status"
}
trap 'recover_on_exit "$?"' EXIT
trap 'recover_on_exit 129' HUP
trap 'recover_on_exit 130' INT
trap 'recover_on_exit 143' TERM
promotion_started=1
GIT_COMMON_DIR="$git_common" \
BASELINE_ATTEMPT_ID="$BASELINE_ATTEMPT_ID" \
CURRENT_RUNTIME_SHA="$EXPECTED_CURRENT_SHA" \
NEXT_TARGET_SHA="$EXPECTED_NEXT_TARGET_SHA" \
RUNNING_API_IMAGE_ID="${running_images[api]}" \
RUNNING_WEB_IMAGE_ID="${running_images[web]}" \
RUNNING_CADDY_IMAGE_ID="${running_images[caddy]}" \
MUTATION_LOCK_FD=9 \
node "$promotion_helper" promote
promotion_started=0
trap - EXIT HUP INT TERM

timeout --foreground --signal=TERM --kill-after=2s 30s \
  env OASIS_PRODUCTION_APP_URL="$EXPECTED_APP_URL" TARGET_SHA="$EXPECTED_CURRENT_SHA" \
  node "$revision_helper" target_exact >/dev/null 2>&1 ||
  fail RUNTIME_BASELINE_POST_VERIFY_UNSAFE
for service in api web caddy postgres; do
  container_id="$(
    timeout --signal=TERM --kill-after=2s 10s "${compose[@]}" ps -q "$service" 2>/dev/null
  )" || fail RUNTIME_BASELINE_POST_VERIFY_UNSAFE
  [[ "$container_id" =~ ^[0-9a-f]{64}$ ]] || fail RUNTIME_BASELINE_POST_VERIFY_UNSAFE
  health="$(
    timeout --signal=TERM --kill-after=2s 10s \
      docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "$container_id" 2>/dev/null
  )" || fail RUNTIME_BASELINE_POST_VERIFY_UNSAFE
  [ "$health" = healthy ] || fail RUNTIME_BASELINE_POST_VERIFY_UNSAFE
done
printf 'RUNTIME_BASELINE_WRAPPER_COMPLETE\n'
