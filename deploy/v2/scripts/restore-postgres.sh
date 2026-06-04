#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
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
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"
PRE_RESTORE_BACKUP_CONFIRMED="${PRE_RESTORE_BACKUP_CONFIRMED:-false}"

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file>" >&2
  exit 2
fi

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  echo "POSTGRES_USER and POSTGRES_DB must be set for restore." >&2
  echo "Tip: create deploy/v2/.env, set ENV_FILE, or pass env vars explicitly." >&2
  exit 2
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

echo "Deployment V2 Postgres restore"
echo "Compose file: $COMPOSE_FILE"
echo "Database: $POSTGRES_DB"
echo "Backup file: $BACKUP_FILE"
echo
echo "WARNING: this restore may overwrite existing database objects."
echo "WARNING: run a fresh backup before restore unless this is a disposable rehearsal."
echo "WARNING: do not run against real client data until the restore process has been rehearsed."

if [[ "$PRE_RESTORE_BACKUP_CONFIRMED" != "true" && "$NON_INTERACTIVE" == "true" ]]; then
  echo "PRE_RESTORE_BACKUP_CONFIRMED=true is required for non-interactive restore." >&2
  exit 2
fi

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  printf 'Type RESTORE to confirm you have a current backup and want to continue: '
  read -r confirmation
  if [[ "$confirmation" != "RESTORE" ]]; then
    echo "Restore cancelled."
    exit 1
  fi
fi

cd "$REPO_ROOT"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  < "$BACKUP_FILE"

echo "Restore complete."
echo "Next production hardening step: rehearse restore from encrypted offsite backup before real client data."
