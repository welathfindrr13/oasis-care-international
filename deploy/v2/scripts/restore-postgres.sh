#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
POSTGRES_USER="${POSTGRES_USER:-oasis}"
POSTGRES_DB="${POSTGRES_DB:-oasis}"
NON_INTERACTIVE="${NON_INTERACTIVE:-false}"

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file>" >&2
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

if [[ "$NON_INTERACTIVE" != "true" ]]; then
  printf 'Type RESTORE to continue: '
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
