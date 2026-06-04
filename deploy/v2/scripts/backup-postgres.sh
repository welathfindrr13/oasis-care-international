#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env}"

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
BACKUP_FILE="${BACKUP_FILE:-${BACKUP_DIR}/oasis-${POSTGRES_DB}-${TIMESTAMP}.dump}"

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  echo "POSTGRES_USER and POSTGRES_DB must be set for backup." >&2
  echo "Tip: create deploy/v2/.env, set ENV_FILE, or pass env vars explicitly." >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"

echo "Creating Deployment V2 Postgres backup..."
echo "Compose file: $COMPOSE_FILE"
echo "Database: $POSTGRES_DB"
echo "Output: $BACKUP_FILE"

cd "$REPO_ROOT"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --no-acl \
  > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"
echo "Store this backup outside the repo working tree for production use."
echo "Next production hardening step: encrypt and copy backups to an offsite UK/EU-compatible provider."
