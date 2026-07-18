#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BINARY="${NODE_BINARY:-node}"
CRYPTO_HELPER="${CRYPTO_HELPER:-${SCRIPT_DIR}/backup-crypto.mjs}"
APPROVED_POSTGRES_IMAGE="pgvector/pgvector@sha256:5af280ae11fab7b9bd4e2eadb2f6e671fa728204741d56eb56b14817a0a74a06"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-$APPROVED_POSTGRES_IMAGE}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:-}"
REQUIRE_EMPTY_APPLICATION_DATA="${REQUIRE_EMPTY_APPLICATION_DATA:-false}"
BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" || -z "$BACKUP_ENCRYPTION_KEY_FILE" ]]; then
  echo "REHEARSAL_CONFIGURATION_INVALID" >&2
  exit 2
fi
if [[ "$POSTGRES_IMAGE" != "$APPROVED_POSTGRES_IMAGE" ]]; then
  echo "REHEARSAL_IMAGE_INVALID" >&2
  exit 2
fi
if [[ "$REQUIRE_EMPTY_APPLICATION_DATA" != "true" && "$REQUIRE_EMPTY_APPLICATION_DATA" != "false" ]]; then
  echo "REHEARSAL_CONFIGURATION_INVALID" >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" || -L "$BACKUP_FILE" ]]; then
  echo "ENCRYPTED_BACKUP_INVALID" >&2
  exit 2
fi
umask 077
restore_session="$(mktemp -d)"
cleanup_session() {
  rm -rf "$restore_session"
}
trap cleanup_session EXIT
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

attempt_id="$($NODE_BINARY -e 'process.stdout.write(require("node:crypto").randomBytes(8).toString("hex"))')"
password="$($NODE_BINARY -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"
if [[ ! "$attempt_id" =~ ^[0-9a-f]{16}$ || ! "$password" =~ ^[0-9a-f]{48}$ ]]; then
  echo "REHEARSAL_STATE_INVALID" >&2
  exit 1
fi

container_name="oasis-restore-rehearsal-${attempt_id}"
env_file="$(mktemp)"
chmod 600 "$env_file"
cat > "$env_file" <<ENV
POSTGRES_USER=oasis_restore
POSTGRES_PASSWORD=${password}
POSTGRES_DB=oasis_restore
ENV
password=""

container_created=false
destroy_container() {
  if ! docker rm -fv "$container_name" >/dev/null 2>&1; then
    return 1
  fi
  if docker inspect "$container_name" >/dev/null 2>&1; then
    return 1
  fi
  container_created=false
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$container_created" == "true" ]]; then
    if ! destroy_container; then
      echo "DISPOSABLE_RESTORE_DESTROY_FAILED" >&2
      status=1
    fi
  fi
  rm -f "$env_file"
  rm -rf "$restore_session"
  exit "$status"
}
trap cleanup EXIT

if ! docker run -d --name "$container_name" --network none --log-driver none \
  --mount type=tmpfs,destination=/var/lib/postgresql/data,tmpfs-size=1073741824 \
  --env-file "$env_file" "$POSTGRES_IMAGE" \
  >/dev/null 2>&1; then
  echo "DISPOSABLE_POSTGRES_START_FAILED" >&2
  exit 1
fi
container_created=true

ready=false
for _attempt in $(seq 1 30); do
  if docker exec "$container_name" pg_isready -U oasis_restore -d oasis_restore \
    >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  echo "DISPOSABLE_POSTGRES_NOT_READY" >&2
  exit 1
fi
echo "DISPOSABLE_POSTGRES_READY"

if ! "$NODE_BINARY" "$CRYPTO_HELPER" decrypt-pinned \
    "$BACKUP_ENCRYPTION_KEY_FILE" "$restore_session/archive.dump.enc" | \
    docker exec -i "$container_name" pg_restore \
      --username oasis_restore \
      --dbname oasis_restore \
      --single-transaction \
      --no-owner \
      --no-acl \
      >/dev/null 2>&1; then
  echo "DISPOSABLE_RESTORE_FAILED" >&2
  exit 1
fi
echo "DISPOSABLE_RESTORE_COMPLETE"

query_result="$(docker exec "$container_name" psql \
  --username oasis_restore \
  --dbname oasis_restore \
  --tuples-only \
  --no-align \
  --command "SELECT CASE WHEN to_regclass('public.organization') IS NOT NULL AND to_regclass('public._prisma_migrations') IS NOT NULL AND (SELECT count(*) FROM public._prisma_migrations) > 0 THEN 'RESTORE_QUERY_OK' ELSE 'RESTORE_QUERY_FAILED' END;" \
  2>/dev/null)"
if [[ "${query_result//$'\r'/}" != "RESTORE_QUERY_OK" ]]; then
  echo "DISPOSABLE_RESTORE_QUERY_FAILED" >&2
  exit 1
fi
echo "DISPOSABLE_RESTORE_QUERY_OK"

if [[ "$REQUIRE_EMPTY_APPLICATION_DATA" == "true" ]]; then
  if ! docker exec "$container_name" psql \
      --username oasis_restore \
      --dbname oasis_restore \
      --set ON_ERROR_STOP=1 \
      --command "DO \$oasis\$ DECLARE candidate record; contains_rows boolean; BEGIN FOR candidate IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = \$value\$public\$value\$ AND tablename <> \$value\$_prisma_migrations\$value\$ LOOP EXECUTE format(\$query\$SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)\$query\$, candidate.schemaname, candidate.tablename) INTO contains_rows; IF contains_rows THEN RAISE EXCEPTION \$message\$application table contains rows\$message\$; END IF; END LOOP; END \$oasis\$;" \
      >/dev/null 2>&1; then
    echo "DISPOSABLE_RESTORE_NOT_EMPTY" >&2
    exit 1
  fi
  echo "DISPOSABLE_RESTORE_EMPTY"
fi

mount_result="$(docker inspect --format '{{range .Mounts}}{{println .Type .Destination}}{{end}}' "$container_name" 2>/dev/null)"
if [[ "$mount_result" != "tmpfs /var/lib/postgresql/data" ]]; then
  echo "DISPOSABLE_RESTORE_DESTROY_FAILED" >&2
  exit 1
fi
if ! destroy_container; then
  echo "DISPOSABLE_RESTORE_DESTROY_FAILED" >&2
  exit 1
fi
rm -f "$env_file"
rm -rf "$restore_session"
trap - EXIT
echo "DISPOSABLE_RESTORE_DESTROYED"
