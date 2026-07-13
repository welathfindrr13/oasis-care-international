#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"
NODE_BINARY="${NODE_BINARY:-node}"
CRYPTO_HELPER="${CRYPTO_HELPER:-${SCRIPT_DIR}/backup-crypto.mjs}"

read_env_value() {
  local name="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi
  awk -F= -v key="$name" '
    $1 == key {
      value = substr($0, index($0, "=") + 1)
      gsub(/^["'\'']|["'\'']$/, "", value)
      print value
      exit
    }
  ' "$ENV_FILE"
}

POSTGRES_USER="${POSTGRES_USER:-$(read_env_value POSTGRES_USER)}"
POSTGRES_DB="${POSTGRES_DB:-$(read_env_value POSTGRES_DB)}"
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"
PRE_RESTORE_BACKUP_CONFIRMED="${PRE_RESTORE_BACKUP_CONFIRMED:-false}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-}"

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 2
fi

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" || -z "$BACKUP_ENCRYPTION_KEY_FILE" ]]; then
  echo "RESTORE_CONFIGURATION_INVALID" >&2
  exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

if [[ "$PRE_RESTORE_BACKUP_CONFIRMED" != "true" ]]; then
  echo "PRE_RESTORE_BACKUP_CONFIRMED=true is required for restore." >&2
  exit 2
fi

umask 077
restore_session="$(mktemp -d)"
cleanup() {
  rm -rf "$restore_session"
}
trap cleanup EXIT

if ! archive_digest="$("$NODE_BINARY" "$CRYPTO_HELPER" prepare \
  "$BACKUP_ENCRYPTION_KEY_FILE" "$BACKUP_FILE" "$restore_session")"; then
  echo "ENCRYPTED_BACKUP_AUTHENTICATION_FAILED" >&2
  exit 2
fi
if [[ ! "$archive_digest" =~ ^[0-9a-f]{64}$ ]]; then
  echo "RESTORE_SESSION_INVALID" >&2
  exit 2
fi
echo "ENCRYPTED_BACKUP_AUTHENTICATED"
echo "RESTORE_ARCHIVE_SHA256=$archive_digest"

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  printf 'Type RESTORE to confirm the target backup and continue: '
  read -r confirmation
  if [[ "$confirmation" != "RESTORE" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

cd "$REPO_ROOT"

compose=(docker compose)
if [[ -f "$ENV_FILE" ]]; then
  compose+=(--env-file "$ENV_FILE")
fi
compose+=(-f "$COMPOSE_FILE")

if ! "$NODE_BINARY" "$CRYPTO_HELPER" decrypt-pinned \
    "$BACKUP_ENCRYPTION_KEY_FILE" "$restore_session/archive.dump.enc" | \
    "${compose[@]}" exec -T postgres \
      pg_restore \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
      --clean \
      --if-exists \
      --single-transaction \
      --no-owner \
      --no-acl \
      >/dev/null 2>&1; then
  echo "RESTORE_FAILED" >&2
  exit 1
fi

rm -rf "$restore_session"
trap - EXIT
echo "RESTORE_COMPLETE"
