#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
POSTGRES_IMAGE="pgvector/pgvector@sha256:5af280ae11fab7b9bd4e2eadb2f6e671fa728204741d56eb56b14817a0a74a06"
TEMP_DIR="$(mktemp -d)"
COMPOSE_FILE="${TEMP_DIR}/compose.yml"
TARGET_COMPOSE_FILE="${TEMP_DIR}/target-compose.yml"
KEY_FILE="${TEMP_DIR}/backup.key"
BACKUP_FILE="${TEMP_DIR}/backup.dump.enc"
PROJECT_NAME="oasis-backup-ci-$$"
TARGET_PROJECT_NAME="${PROJECT_NAME}-target"

cleanup() {
  local status=$?
  trap - EXIT
  if ! docker compose -f "$TARGET_COMPOSE_FILE" -p "$TARGET_PROJECT_NAME" down -v \
    >/dev/null 2>&1; then
    echo "BACKUP_RESTORE_TARGET_DESTROY_FAILED" >&2
    status=1
  fi
  if ! docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v \
    >/dev/null 2>&1; then
    echo "BACKUP_RESTORE_SOURCE_DESTROY_FAILED" >&2
    status=1
  fi
  if [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=${PROJECT_NAME}")" ]] || \
    [[ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=${PROJECT_NAME}")" ]] || \
    [[ -n "$(docker ps -aq --filter "label=com.docker.compose.project=${TARGET_PROJECT_NAME}")" ]] || \
    [[ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=${TARGET_PROJECT_NAME}")" ]]; then
    echo "BACKUP_RESTORE_SOURCE_DESTROY_FAILED" >&2
    status=1
  fi
  rm -rf "$TEMP_DIR"
  exit "$status"
}
trap cleanup EXIT

cat > "$COMPOSE_FILE" <<YAML
services:
  postgres:
    image: ${POSTGRES_IMAGE}
    environment:
      POSTGRES_USER: oasis_source
      POSTGRES_PASSWORD: synthetic-source-only
      POSTGRES_DB: oasis_source
    ports:
      - "127.0.0.1::5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oasis_source -d oasis_source"]
      interval: 2s
      timeout: 2s
      retries: 30
YAML

cat > "$TARGET_COMPOSE_FILE" <<YAML
services:
  postgres:
    image: ${POSTGRES_IMAGE}
    environment:
      POSTGRES_USER: oasis_target
      POSTGRES_PASSWORD: synthetic-target-only
      POSTGRES_DB: oasis_target
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U oasis_target -d oasis_target"]
      interval: 2s
      timeout: 2s
      retries: 30
YAML

cd "$REPO_ROOT"
docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --wait \
  >/dev/null
source_container="$(docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps -q postgres)"
if [[ ! "$source_container" =~ ^[0-9a-f]{64}$ ]]; then
  echo "BACKUP_RESTORE_SOURCE_CONTAINER_INVALID" >&2
  exit 1
fi
node "$SCRIPT_DIR/production-signals.mjs" disk-probe "$source_container"
host_port="$(docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" port postgres 5432 | awk -F: '{print $NF}')"
if [[ ! "$host_port" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RESTORE_INTEGRATION_PORT_INVALID" >&2
  exit 1
fi

DATABASE_URL="postgresql://oasis_source:synthetic-source-only@127.0.0.1:${host_port}/oasis_source" \
  pnpm --dir libs/db exec prisma migrate deploy >/dev/null

umask 077
openssl rand -hex -out "$KEY_FILE" 32
chmod 600 "$KEY_FILE"

COMPOSE_PROJECT_NAME="$PROJECT_NAME" \
POSTGRES_USER=oasis_source \
POSTGRES_DB=oasis_source \
COMPOSE_FILE="$COMPOSE_FILE" \
BACKUP_ENCRYPTION_KEY_FILE="$KEY_FILE" \
BACKUP_FILE="$BACKUP_FILE" \
  "$SCRIPT_DIR/backup-postgres.sh"

docker compose -f "$TARGET_COMPOSE_FILE" -p "$TARGET_PROJECT_NAME" up -d --wait \
  >/dev/null
COMPOSE_PROJECT_NAME="$TARGET_PROJECT_NAME" \
POSTGRES_USER=oasis_target \
POSTGRES_DB=oasis_target \
COMPOSE_FILE="$TARGET_COMPOSE_FILE" \
BACKUP_ENCRYPTION_KEY_FILE="$KEY_FILE" \
PRE_RESTORE_BACKUP_CONFIRMED=true \
NON_INTERACTIVE=true \
  "$SCRIPT_DIR/restore-postgres.sh" "$BACKUP_FILE"

target_query="$(docker compose -f "$TARGET_COMPOSE_FILE" -p "$TARGET_PROJECT_NAME" \
  exec -T postgres psql --username oasis_target --dbname oasis_target \
  --tuples-only --no-align \
  --command "SELECT CASE WHEN (SELECT count(*) FROM public._prisma_migrations) > 0 THEN 'TARGET_RESTORE_OK' ELSE 'TARGET_RESTORE_FAILED' END;" \
  2>/dev/null)"
if [[ "${target_query//$'\r'/}" != "TARGET_RESTORE_OK" ]]; then
  echo "BACKUP_RESTORE_TARGET_QUERY_FAILED" >&2
  exit 1
fi
echo "BACKUP_RESTORE_TARGET_QUERY_OK"

BACKUP_ENCRYPTION_KEY_FILE="$KEY_FILE" \
POSTGRES_IMAGE="$POSTGRES_IMAGE" \
  "$SCRIPT_DIR/rehearse-backup-restore.sh" "$BACKUP_FILE"

echo "BACKUP_RESTORE_INTEGRATION_OK"
