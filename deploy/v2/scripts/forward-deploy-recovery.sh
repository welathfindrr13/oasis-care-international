#!/usr/bin/env bash
set -euo pipefail
umask 077

TARGET_SHA="${TARGET_SHA:-}"
ATTEMPT_ID="${ATTEMPT_ID:-}"
APP_URL="${APP_URL:-}"
HELPER_DIR="${HELPER_DIR:-}"
DIAGNOSTIC_TIMEOUT_SECONDS="${DIAGNOSTIC_TIMEOUT_SECONDS:-10}"
REVISION_PROOF_TIMEOUT_SECONDS="${REVISION_PROOF_TIMEOUT_SECONDS:-30}"
STATE_OPERATION_TIMEOUT_SECONDS="${STATE_OPERATION_TIMEOUT_SECONDS:-15}"
ROLLBACK_TIMEOUT_SECONDS="${ROLLBACK_TIMEOUT_SECONDS:-300}"
SHORT_KILL_GRACE_SECONDS="${SHORT_KILL_GRACE_SECONDS:-2}"
PHASE_KILL_GRACE_SECONDS="${PHASE_KILL_GRACE_SECONDS:-15}"
RECOVERY_LOCK_WAIT_SECONDS="${RECOVERY_LOCK_WAIT_SECONDS:-2692}"
REPOSITORY_ROOT="${OASIS_FORWARD_REPOSITORY_ROOT:-/opt/oasis-care}"

result_file="$HELPER_DIR/recovery-result"
ready_file="$HELPER_DIR/recovery-supervisor-ready"
supervisor_lock="$HELPER_DIR/recovery-supervisor.lock"
diagnostic_file="$HELPER_DIR/recovery-diagnostic"
binding_export="$HELPER_DIR/recovery-legacy-binding"
rollback_override="$HELPER_DIR/recovery-rollback-override.yml"
forward_helper="$HELPER_DIR/forward-deploy-state.mjs"
legacy_helper="$HELPER_DIR/legacy-bootstrap-state.mjs"
revision_helper="$HELPER_DIR/revision-proof.mjs"
recovery_armed=0

write_result() {
  local category="$1" temporary
  case "$category" in
    FORWARD_RECOVERY_COMPLETE_VERIFIED|FORWARD_RECOVERY_LEGACY_VERIFIED|FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN|FORWARD_RECOVERY_NO_MUTATION|FORWARD_RECOVERY_ROLLBACK_FAILED|FORWARD_RECOVERY_STATE_UNCERTAIN|FORWARD_RECOVERY_SUPERVISOR_FAILED) ;;
    *) category=FORWARD_RECOVERY_SUPERVISOR_FAILED ;;
  esac
  [ ! -e "$result_file" ] || return 0
  temporary="$HELPER_DIR/.recovery-result.$$"
  (umask 077; printf '%s\n' "$category" > "$temporary") || return 1
  chmod 600 "$temporary" || return 1
  mv -T "$temporary" "$result_file"
}

cleanup() {
  timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" \
    rm -f "$diagnostic_file" "$binding_export" "$rollback_override" "$ready_file" >/dev/null 2>&1 || true
}

unexpected_exit() {
  local status="$?"
  trap - EXIT HUP INT TERM
  cleanup
  if [ "$status" -ne 0 ] && [ ! -e "$result_file" ] && [ "$recovery_armed" -eq 1 ] && declare -F rollback_legacy_runtime >/dev/null; then
    if rollback_legacy_runtime; then
      write_result FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN || true
    else
      write_result FORWARD_RECOVERY_ROLLBACK_FAILED || true
    fi
  fi
  exit "$status"
}

trap 'unexpected_exit' EXIT
trap 'exit 1' HUP INT TERM

[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
[ "$TARGET_SHA" = "18aacd8458a3f96a38bf470d9a4c837ad563fa5c" ] || exit 1
[[ "$ATTEMPT_ID" =~ ^[0-9a-f]{32}$ ]] || exit 1
[[ "$HELPER_DIR" =~ ^/var/tmp/oasis-forward-deploy\.[A-Za-z0-9]{8}$ ]] || {
  [ "${OASIS_FORWARD_RECOVERY_TEST_MODE:-0}" = 1 ] || exit 1
  [[ "$HELPER_DIR" = /tmp/oasis-forward-recovery-test.* ]] || exit 1
}
[ "$result_file" = "$HELPER_DIR/recovery-result" ] || exit 1
[ "$DIAGNOSTIC_TIMEOUT_SECONDS" = 10 ] || exit 1
[ "$REVISION_PROOF_TIMEOUT_SECONDS" = 30 ] || exit 1
[ "$STATE_OPERATION_TIMEOUT_SECONDS" = 15 ] || exit 1
[ "$ROLLBACK_TIMEOUT_SECONDS" = 300 ] || exit 1
[ "$SHORT_KILL_GRACE_SECONDS" = 2 ] || exit 1
[ "$PHASE_KILL_GRACE_SECONDS" = 15 ] || exit 1
[[ "$RECOVERY_LOCK_WAIT_SECONDS" =~ ^[0-9]+$ ]] || exit 1
[ -d "$HELPER_DIR" ] && [ ! -L "$HELPER_DIR" ] || exit 1
for helper in "$forward_helper" "$legacy_helper" "$revision_helper"; do
  [ -f "$helper" ] && [ ! -L "$helper" ] || exit 1
done
if [ "${OASIS_FORWARD_RECOVERY_TEST_MODE:-0}" != 1 ]; then
  [ "$(id -un 2>/dev/null)" = deploy ] || exit 1
  [ "$REPOSITORY_ROOT" = /opt/oasis-care ] || exit 1
fi
[ -d "$REPOSITORY_ROOT/.git" ] || exit 1

exec 8>"$supervisor_lock"
flock -n 8 || exit 0
[ ! -e "$result_file" ] || exit 0

cd "$REPOSITORY_ROOT"
git_common_raw="$(git rev-parse --git-common-dir 2>/dev/null)" || exit 1
git_common="$(cd "$git_common_raw" 2>/dev/null && pwd -P)" || exit 1
legacy_state_dir="$git_common/oasis-deploy/legacy-bootstrap-v1/state"
forward_state_root="$git_common/oasis-deploy/forward-deployment-v1"
mutation_lock="$git_common/oasis-deploy/production-vps-mutation.lock"

exec 9>"$mutation_lock"
ready_temporary="$HELPER_DIR/.recovery-supervisor-ready.$$"
(umask 077; printf 'FORWARD_RECOVERY_SUPERVISOR_READY\n' > "$ready_temporary") || exit 1
chmod 600 "$ready_temporary" || exit 1
mv -T "$ready_temporary" "$ready_file" || exit 1
if ! flock -w "$RECOVERY_LOCK_WAIT_SECONDS" 9; then
  exit 0
fi

timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" \
  bash -c 'rm -f "$1" "$2" "$3" && touch "$1" && chmod 600 "$1"' \
  bash "$diagnostic_file" "$binding_export" "$rollback_override" || exit 1

timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
  env LEGACY_STATE_DIR="$legacy_state_dir" LEGACY_STATE_HELPER="$legacy_helper" \
  FORWARD_BINDING_EXPORT="$binding_export" node "$forward_helper" inspect-legacy \
  >"$diagnostic_file" 2>&1 || exit 1
declare -A legacy_values
while IFS='=' read -r key value; do
  case "$key" in
    LEGACY_STATE_DIGEST|LEGACY_TARGET_SHA|LEGACY_ATTEMPT_ID|API_IMAGE_ID|API_IMAGE_ALIAS|WEB_IMAGE_ID|WEB_IMAGE_ALIAS|CADDY_IMAGE_ID|CADDY_IMAGE_ALIAS)
      [ -z "${legacy_values[$key]+x}" ] || exit 1
      legacy_values["$key"]="$value"
      ;;
    *) exit 1 ;;
  esac
done < "$binding_export"
[ "${#legacy_values[@]}" -eq 9 ] || exit 1

compose=(docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml)

verify_rollback_aliases() {
  local service alias_key image_key alias_id
  for service in API WEB CADDY; do
    alias_key="${service}_IMAGE_ALIAS"
    image_key="${service}_IMAGE_ID"
    alias_id="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker image inspect --format '{{.Id}}' "${legacy_values[$alias_key]}" 2>/dev/null)" || return 1
    [ "$alias_id" = "${legacy_values[$image_key]}" ] || return 1
  done
}

service_state_category() {
  local service="$1" container_id details status health exit_code oom_killed
  container_id="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" "${compose[@]}" ps -q "$service" 2>/dev/null)" || {
    printf 'MISSING\n'
    return
  }
  if [[ ! "$container_id" =~ ^[0-9a-f]{64}$ ]]; then
    printf 'MISSING\n'
    return
  fi
  details="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.ExitCode}}|{{.State.OOMKilled}}' "$container_id" 2>/dev/null)" || {
    printf 'OTHER\n'
    return
  }
  IFS='|' read -r status health exit_code oom_killed <<< "$details"
  if [ "$oom_killed" = true ]; then
    printf 'OOM_KILLED\n'
  elif [ "$status" = running ] && [ "$health" = healthy ]; then
    printf 'RUNNING_HEALTHY\n'
  elif [ "$status" = running ]; then
    printf 'RUNNING_UNHEALTHY\n'
  elif [ "$status" = exited ] && [ "$exit_code" = 0 ]; then
    printf 'EXITED_ZERO\n'
  elif [ "$status" = exited ]; then
    printf 'EXITED_NONZERO\n'
  else
    printf 'OTHER\n'
  fi
}

service_log_category() {
  local service="$1" container_id log_material category
  container_id="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" "${compose[@]}" ps -q "$service" 2>/dev/null || true)"
  if [[ "$container_id" =~ ^[0-9a-f]{64}$ ]]; then
    log_material="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker logs --tail 200 "$container_id" 2>&1 || true)"
  else
    log_material=''
  fi
  shopt -s nocasematch
  if [[ "$log_material" =~ MODULE_NOT_FOUND|Cannot[[:space:]]+find[[:space:]]+module|module[[:space:]]+resolution ]]; then
    category=MODULE_RESOLUTION_FAILURE
  elif [[ "$log_material" =~ ECONNREFUSED|database.*(failed|error|unavailable)|postgres.*(failed|error|unavailable) ]]; then
    category=DATABASE_CONNECTION_FAILURE
  elif [[ "$log_material" =~ configuration|environment[[:space:]]+variable|invalid[[:space:]]+config|validation[[:space:]]+failed ]]; then
    category=CONFIGURATION_FAILURE
  elif [[ "$log_material" =~ /ready|health(check)?|unhealthy|dependency[[:space:]]+failed[[:space:]]+to[[:space:]]+start ]]; then
    category=READINESS_FAILURE
  elif [ -n "$log_material" ]; then
    category=NO_MATCH
  else
    category=UNAVAILABLE
  fi
  shopt -u nocasematch
  unset log_material
  printf '%s\n' "$category"
}

record_recovery_evidence() {
  local failure_class="$1" phase="$2"
  FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
    FAILURE_CLASS="$failure_class" FAILURE_PHASE="$phase" \
    API_STATE_CATEGORY="$(service_state_category api)" \
    WEB_STATE_CATEGORY="$(service_state_category web)" \
    CADDY_STATE_CATEGORY="$(service_state_category caddy)" \
    API_LOG_CATEGORY="$(service_log_category api)" \
    WEB_LOG_CATEGORY="$(service_log_category web)" \
    CADDY_LOG_CATEGORY="$(service_log_category caddy)" \
    timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
    node "$forward_helper" record-evidence >"$diagnostic_file" 2>&1 || return 1
}

ensure_existing_failure_evidence() {
  local details failure_class='' evidence_state='' fetch_state='' fetch_status='' fetch_category='' phase line
  details="$(timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
    env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
    node "$forward_helper" inspect-failure 2>"$diagnostic_file")" || return 1
  while IFS= read -r line; do
    case "$line" in
      FORWARD_FAILURE_CLASS_*) failure_class="${line#FORWARD_FAILURE_CLASS_}" ;;
      FORWARD_FAILURE_EVIDENCE_*) evidence_state="${line#FORWARD_FAILURE_EVIDENCE_}" ;;
      FORWARD_FETCH_DIAGNOSTIC_*) fetch_state="${line#FORWARD_FETCH_DIAGNOSTIC_}" ;;
      FORWARD_FETCH_EXIT_STATUS_*) fetch_status="${line#FORWARD_FETCH_EXIT_STATUS_}" ;;
      FORWARD_FETCH_CATEGORY_*) fetch_category="${line#FORWARD_FETCH_CATEGORY_}" ;;
      *) return 1 ;;
    esac
  done <<< "$details"
  case "$fetch_state" in
    PRESENT)
      [[ "$fetch_status" =~ ^([1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$ ]] || return 1
      case "$fetch_category" in
        FETCH_TIMEOUT|FETCH_TERMINATED|FETCH_AUTHENTICATION|FETCH_DNS|FETCH_TLS|FETCH_NETWORK|FETCH_REMOTE_REF|FETCH_PACK_TRANSFER|FETCH_PACK_FINALIZATION|FETCH_OBJECT_CORRUPTION|FETCH_REF_LOCK|FETCH_DISK|FETCH_INODE|FETCH_UNKNOWN) ;;
        *) return 1 ;;
      esac
      ;;
    ABSENT)
      [ -z "$fetch_status" ] && [ -z "$fetch_category" ] || return 1
      ;;
    *) return 1 ;;
  esac
  case "$failure_class" in
    CHECKOUT_FAILED) phase=CHECKOUT ;;
    PREFLIGHT_FAILED) phase=PREFLIGHT ;;
    BUILD_FAILED) phase=BUILD ;;
    RUNTIME_REPLACEMENT_FAILED) phase=RUNTIME_REPLACEMENT ;;
    CONTAINER_HEALTH_FAILED) phase=CONTAINER_HEALTH ;;
    REVISION_PROOF_FAILED) phase=REVISION_PROOF ;;
    LEGACY_STATE_CHANGED) phase=LEGACY_STATE ;;
    TRANSPORT_RECOVERY_REQUIRED) phase=TRANSPORT ;;
    COMPLETION_STATE_UNCERTAIN) phase=COMPLETION ;;
    UNEXPECTED_FAILURE) phase=UNEXPECTED_EXIT ;;
    *) return 1 ;;
  esac
  case "$evidence_state" in
    PRESENT) return 0 ;;
    ABSENT) record_recovery_evidence "$failure_class" "$phase" ;;
    *) return 1 ;;
  esac
}

fetch_diagnostic_is_persisted() {
  local fetch_state
  fetch_state="$(timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
    env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
    node "$forward_helper" inspect-fetch 2>"$diagnostic_file")" || return 1
  [ "$fetch_state" = FORWARD_FETCH_DIAGNOSTIC_PRESENT ]
}

verify_service_health_and_image() {
  local service="$1" expected_image="$2" container_id health_status running_image
  container_id="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" "${compose[@]}" ps -q "$service" 2>/dev/null)" || return 1
  [[ "$container_id" =~ ^[0-9a-f]{64}$ ]] || return 1
  health_status="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null)" || return 1
  [ "$health_status" = healthy ] || return 1
  if [ -n "$expected_image" ]; then
    running_image="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker inspect --format '{{.Image}}' "$container_id" 2>/dev/null)" || return 1
    [ "$running_image" = "$expected_image" ] || return 1
  fi
}

verify_postgres_health() {
  local container_id health_status
  container_id="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" "${compose[@]}" ps -q postgres 2>/dev/null)" || return 1
  [[ "$container_id" =~ ^[0-9a-f]{64}$ ]] || return 1
  health_status="$(timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null)" || return 1
  [ "$health_status" = healthy ]
}

verify_legacy_runtime() {
  verify_rollback_aliases || return 1
  verify_service_health_and_image api "${legacy_values[API_IMAGE_ID]}" || return 1
  verify_service_health_and_image web "${legacy_values[WEB_IMAGE_ID]}" || return 1
  verify_service_health_and_image caddy "${legacy_values[CADDY_IMAGE_ID]}" || return 1
  verify_postgres_health || return 1
  timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${REVISION_PROOF_TIMEOUT_SECONDS}s" \
    env OASIS_PRODUCTION_APP_URL="$APP_URL" TARGET_SHA="${legacy_values[LEGACY_TARGET_SHA]}" \
    node "$revision_helper" rollback_legacy >"$diagnostic_file" 2>&1 || return 1
  timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
    env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
    LEGACY_STATE_DIR="$legacy_state_dir" LEGACY_STATE_HELPER="$legacy_helper" \
    node "$forward_helper" verify-legacy >"$diagnostic_file" 2>&1 || return 1
  verify_rollback_aliases
}

verify_target_runtime() {
  verify_rollback_aliases || return 1
  verify_service_health_and_image api '' || return 1
  verify_service_health_and_image web '' || return 1
  verify_service_health_and_image caddy "${legacy_values[CADDY_IMAGE_ID]}" || return 1
  verify_postgres_health || return 1
  timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${REVISION_PROOF_TIMEOUT_SECONDS}s" \
    env OASIS_PRODUCTION_APP_URL="$APP_URL" TARGET_SHA="$TARGET_SHA" \
    node "$revision_helper" target_exact >"$diagnostic_file" 2>&1 || return 1
  timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
    env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
    LEGACY_STATE_DIR="$legacy_state_dir" LEGACY_STATE_HELPER="$legacy_helper" \
    node "$forward_helper" verify-legacy >"$diagnostic_file" 2>&1 || return 1
  verify_rollback_aliases
}

rollback_legacy_runtime() {
  verify_rollback_aliases || return 1
  timeout --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${DIAGNOSTIC_TIMEOUT_SECONDS}s" \
    bash -c 'printf "services:\n  api:\n    image: %s\n  web:\n    image: %s\n  caddy:\n    image: %s\n" "$2" "$3" "$4" > "$1" && chmod 600 "$1"' \
    bash "$rollback_override" "${legacy_values[API_IMAGE_ALIAS]}" "${legacy_values[WEB_IMAGE_ALIAS]}" "${legacy_values[CADDY_IMAGE_ALIAS]}" || return 1
  rollback_compose=(docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml -f "$rollback_override")
  timeout --foreground --signal=TERM --kill-after="${PHASE_KILL_GRACE_SECONDS}s" "${ROLLBACK_TIMEOUT_SECONDS}s" \
    env RUN_MIGRATIONS=false MEDICATION_EMAR_ENABLED=false \
    APP_COMMIT_SHA="${legacy_values[LEGACY_TARGET_SHA]}" APP_VERSION="${legacy_values[LEGACY_TARGET_SHA]:0:12}" \
    "${rollback_compose[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web caddy \
    >"$diagnostic_file" 2>&1 || return 1
  compose=(docker compose --env-file deploy/v2/.env -f deploy/v2/docker-compose.yml -f "$rollback_override")
  verify_legacy_runtime
}

recovery_armed=1

state_output="$(timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
  env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
  node "$forward_helper" adjudicate-completion 2>"$diagnostic_file")" || {
  if rollback_legacy_runtime; then
    recovery_armed=0
    write_result FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN
  else
    write_result FORWARD_RECOVERY_ROLLBACK_FAILED
  fi
  exit 1
}

case "$state_output" in
  FORWARD_STATE_COMPLETE)
    if verify_target_runtime; then
      recovery_armed=0
      write_result FORWARD_RECOVERY_COMPLETE_VERIFIED
      exit 0
    fi
    timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
      env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
      NEXT_STATE=COMPLETION_UNCERTAIN FAILURE_CLASS=COMPLETION_STATE_UNCERTAIN \
      node "$forward_helper" transition >"$diagnostic_file" 2>&1 || {
        if rollback_legacy_runtime; then
          recovery_armed=0
          write_result FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN
        else
          write_result FORWARD_RECOVERY_ROLLBACK_FAILED
        fi
        exit 1
      }
    record_recovery_evidence COMPLETION_STATE_UNCERTAIN COMPLETION || true
    ;;
  FORWARD_STATE_MUTATION_STARTED)
    mutation_failure_class=TRANSPORT_RECOVERY_REQUIRED
    mutation_failure_phase=TRANSPORT
    if fetch_diagnostic_is_persisted; then
      mutation_failure_class=CHECKOUT_FAILED
      mutation_failure_phase=CHECKOUT
    fi
    timeout --foreground --signal=TERM --kill-after="${SHORT_KILL_GRACE_SECONDS}s" "${STATE_OPERATION_TIMEOUT_SECONDS}s" \
      env FORWARD_STATE_ROOT="$forward_state_root" ATTEMPT_ID="$ATTEMPT_ID" \
      NEXT_STATE=RECOVERABLE_FAILURE FAILURE_CLASS="$mutation_failure_class" \
      node "$forward_helper" transition >"$diagnostic_file" 2>&1 || {
        if rollback_legacy_runtime; then
          recovery_armed=0
          write_result FORWARD_RECOVERY_LEGACY_VERIFIED_STATE_UNCERTAIN
        else
          write_result FORWARD_RECOVERY_ROLLBACK_FAILED
        fi
        exit 1
      }
    record_recovery_evidence "$mutation_failure_class" "$mutation_failure_phase" || true
    ;;
  FORWARD_STATE_RECOVERABLE_FAILURE|FORWARD_STATE_COMPLETION_UNCERTAIN)
    ensure_existing_failure_evidence || true
    ;;
  FORWARD_STATE_PREPARED)
    if verify_legacy_runtime; then
      recovery_armed=0
      write_result FORWARD_RECOVERY_NO_MUTATION
      exit 1
    fi
    ;;
  *)
    write_result FORWARD_RECOVERY_STATE_UNCERTAIN
    exit 1
    ;;
esac

if rollback_legacy_runtime; then
  recovery_armed=0
  write_result FORWARD_RECOVERY_LEGACY_VERIFIED
  exit 1
fi
write_result FORWARD_RECOVERY_ROLLBACK_FAILED
exit 1
