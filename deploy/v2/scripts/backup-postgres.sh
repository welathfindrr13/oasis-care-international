#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/../.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${DEPLOY_DIR}/docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
POSTGRES_USER="${POSTGRES_USER:-oasis}"
POSTGRES_DB="${POSTGRES_DB:-oasis}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_FILE:-${BACKUP_DIR}/oasis-${POSTGRES_DB}-${TIMESTAMP}.dump}"

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
echo "Next production hardening step: encrypt and copy backups to an offsite UK/EU-compatible provider."
