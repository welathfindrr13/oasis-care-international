#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
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
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_FILE:-${BACKUP_DIR}/oasis-${POSTGRES_DB}-${TIMESTAMP}.dump.enc}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-}"

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" || -z "$BACKUP_ENCRYPTION_KEY_FILE" ]]; then
  echo "BACKUP_CONFIGURATION_INVALID" >&2
  exit 2
fi

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
if [[ -e "$BACKUP_FILE" || -L "$BACKUP_FILE" ]]; then
  echo "BACKUP_DESTINATION_EXISTS" >&2
  exit 2
fi
if ! "$NODE_BINARY" "$CRYPTO_HELPER" validate-key "$BACKUP_ENCRYPTION_KEY_FILE"; then
  echo "BACKUP_KEY_INVALID" >&2
  exit 2
fi

TEMP_BACKUP_FILE="$(mktemp "${BACKUP_FILE}.tmp.XXXXXX")"
cleanup() {
  rm -f "$TEMP_BACKUP_FILE"
}
trap cleanup EXIT

echo "BACKUP_ENCRYPTION_READY"

cd "$REPO_ROOT"

if ! docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --no-owner \
    --no-acl | \
    "$NODE_BINARY" "$CRYPTO_HELPER" encrypt "$BACKUP_ENCRYPTION_KEY_FILE" "$TEMP_BACKUP_FILE"; then
  echo "BACKUP_CREATION_FAILED" >&2
  exit 1
fi

chmod 600 "$TEMP_BACKUP_FILE"
if ! ln "$TEMP_BACKUP_FILE" "$BACKUP_FILE"; then
  echo "BACKUP_DESTINATION_EXISTS" >&2
  exit 2
fi
rm -f "$TEMP_BACKUP_FILE"
trap - EXIT

echo "BACKUP_CREATED_ENCRYPTED"
