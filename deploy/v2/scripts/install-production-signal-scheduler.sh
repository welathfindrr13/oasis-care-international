#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null
GIT_PAGER=cat
GIT_OPTIONAL_LOCKS=0
GIT_NO_REPLACE_OBJECTS=1
export GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM GIT_PAGER GIT_OPTIONAL_LOCKS \
  GIT_NO_REPLACE_OBJECTS
unset BASH_ENV ENV CDPATH NODE_OPTIONS NODE_PATH \
  GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE \
  GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES 2>/dev/null || true

REPOSITORY=/opt/oasis-care
CONFIG_DIRECTORY=/etc/oasis
CONFIG_FILE=$CONFIG_DIRECTORY/production-signals.env
HEARTBEAT_FILE=/var/lib/oasis-production-signals/heartbeat.json
BACKUP_DIRECTORY=/var/backups/oasis
PRODUCTION_BACKUP_KEY_FILE=/etc/oasis/oasis-backup.key
RUNTIME_ROOT=/usr/local/lib/oasis-production-signals
VERIFIER_COMMAND=/usr/local/sbin/oasis-verify-production-signal-scheduler
SERVICE_UNIT=oasis-production-signals.service
TIMER_UNIT=oasis-production-signals.timer

fail() {
  printf 'PRODUCTION_SIGNAL_SCHEDULER_INSTALL_FAILED\n' >&2
  exit 1
}

[ "$EUID" -eq 0 ] || fail
set +u
[ -n "$TARGET_SHA" ] || fail
[ -n "$OASIS_PRODUCTION_APP_URL" ] || fail
[ -n "$BACKUP_ENCRYPTION_KEY_FILE" ] || fail
set -u
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail
[[ "$OASIS_PRODUCTION_APP_URL" =~ ^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?/?$ ]] || fail
[[ "$BACKUP_ENCRYPTION_KEY_FILE" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail
[ "$BACKUP_ENCRYPTION_KEY_FILE" = "$PRODUCTION_BACKUP_KEY_FILE" ] || fail
case "$BACKUP_ENCRYPTION_KEY_FILE" in
  /home/*|/root/*|/run/user/*) fail ;;
esac

for executable in \
  /usr/bin/chmod \
  /usr/bin/diff \
  /usr/bin/dirname \
  /usr/bin/docker \
  /usr/bin/git \
  /usr/bin/install \
  /usr/bin/ln \
  /usr/bin/mktemp \
  /usr/bin/mv \
  /usr/bin/node \
  /usr/bin/rm \
  /usr/bin/stat \
  /usr/bin/systemctl \
  /usr/bin/systemd-analyze
do
  [ -x "$executable" ] || fail
done
[ "$(/usr/bin/stat -c '%u:%g:%a' "$BACKUP_ENCRYPTION_KEY_FILE" 2>/dev/null)" = 0:0:600 ] || fail

cd "$REPOSITORY" 2>/dev/null || fail
[ -d .git ] || fail
[ ! -L .git ] || fail
[ "$(/usr/bin/git --no-replace-objects rev-parse --is-inside-work-tree 2>/dev/null)" = true ] || fail
[ "$(/usr/bin/git --no-replace-objects rev-parse HEAD 2>/dev/null)" = "$TARGET_SHA" ] || fail
[ "$(/usr/bin/git --no-replace-objects rev-parse origin/main 2>/dev/null)" = "$TARGET_SHA" ] || fail
/usr/bin/git --no-replace-objects cat-file -e "$TARGET_SHA^{commit}" 2>/dev/null || fail

for private_file in deploy/v2/.env "$BACKUP_ENCRYPTION_KEY_FILE"; do
  [ -f "$private_file" ] || fail
  [ ! -L "$private_file" ] || fail
  [ "$(/usr/bin/stat -c '%a' "$private_file" 2>/dev/null)" = 600 ] || fail
done

runtime_version=$RUNTIME_ROOT/$TARGET_SHA
runtime_current=$RUNTIME_ROOT/current
runtime_temporary=
runtime_link_temporary=
temporary_config=
temporary_service=
temporary_timer=
temporary_verifier=
cleanup() {
  [ -z "$runtime_temporary" ] || /usr/bin/rm -rf "$runtime_temporary"
  [ -z "$runtime_link_temporary" ] || /usr/bin/rm -f "$runtime_link_temporary"
  [ -z "$temporary_config" ] || /usr/bin/rm -f "$temporary_config"
  [ -z "$temporary_service" ] || /usr/bin/rm -f "$temporary_service"
  [ -z "$temporary_timer" ] || /usr/bin/rm -f "$temporary_timer"
  [ -z "$temporary_verifier" ] || /usr/bin/rm -f "$temporary_verifier"
}
trap cleanup EXIT

[ ! -L "$RUNTIME_ROOT" ] || fail
/usr/bin/install -d -m 0700 "$RUNTIME_ROOT" || fail
[ "$(/usr/bin/stat -c '%a' "$RUNTIME_ROOT" 2>/dev/null)" = 700 ] || fail
[ "$(/usr/bin/stat -c '%u' "$RUNTIME_ROOT" 2>/dev/null)" = 0 ] || fail
runtime_temporary="$(/usr/bin/mktemp -d "$RUNTIME_ROOT/.runtime.XXXXXXXX")" || fail
/usr/bin/chmod 0700 "$runtime_temporary" || fail

while IFS= read -r object_path; do
  [ -n "$object_path" ] || fail
  destination=$runtime_temporary/$object_path
  destination_directory=$(/usr/bin/dirname "$destination") || fail
  /usr/bin/install -d -m 0700 "$destination_directory" || fail
  if ! /usr/bin/git --no-replace-objects show \
    "$TARGET_SHA:$object_path" >"$destination" 2>/dev/null
  then
    fail
  fi
  /usr/bin/chmod 0400 "$destination" || fail
done <<'RUNTIME_OBJECTS'
.github/workflows/revision-proof.mjs
deploy/v2/Caddyfile
deploy/v2/docker-compose.yml
deploy/v2/scripts/backup-crypto.mjs
deploy/v2/scripts/production-signals.mjs
deploy/v2/scripts/production-signal-runner.mjs
deploy/v2/scripts/verify-production-signal-scheduler.sh
deploy/v2/systemd/oasis-production-signals.service
deploy/v2/systemd/oasis-production-signals.timer
RUNTIME_OBJECTS

/usr/bin/node --check \
  "$runtime_temporary/deploy/v2/scripts/production-signal-runner.mjs" \
  >/dev/null 2>&1 || fail
/usr/bin/node --check \
  "$runtime_temporary/deploy/v2/scripts/production-signals.mjs" \
  >/dev/null 2>&1 || fail

if [ -e "$runtime_version" ] || [ -L "$runtime_version" ]; then
  [ -d "$runtime_version" ] || fail
  [ ! -L "$runtime_version" ] || fail
  /usr/bin/diff -qr "$runtime_temporary" "$runtime_version" \
    >/dev/null 2>&1 || fail
  /usr/bin/rm -rf "$runtime_temporary"
  runtime_temporary=
else
  /usr/bin/mv "$runtime_temporary" "$runtime_version" || fail
  runtime_temporary=
fi

if [ -e "/etc/systemd/system/$TIMER_UNIT" ]; then
  /usr/bin/systemctl disable --now "$TIMER_UNIT" >/dev/null 2>&1 || fail
  /usr/bin/systemctl stop "$SERVICE_UNIT" >/dev/null 2>&1 || fail
fi

runtime_link_temporary=$RUNTIME_ROOT/.current.$$
/usr/bin/ln -s "$runtime_version" "$runtime_link_temporary" || fail
/usr/bin/mv -Tf "$runtime_link_temporary" "$runtime_current" || fail
runtime_link_temporary=

[ ! -L /usr/local/sbin ] || fail
/usr/bin/install -d -m 0755 /usr/local/sbin || fail
temporary_verifier="$(/usr/bin/mktemp "/usr/local/sbin/.oasis-verifier.XXXXXXXX")" || fail
/usr/bin/install -m 0500 \
  "$runtime_current/deploy/v2/scripts/verify-production-signal-scheduler.sh" \
  "$temporary_verifier" || fail
/usr/bin/mv -f "$temporary_verifier" "$VERIFIER_COMMAND" || fail
temporary_verifier=

[ ! -L "$CONFIG_DIRECTORY" ] || fail
/usr/bin/install -d -m 0700 "$CONFIG_DIRECTORY" || fail
[ "$(/usr/bin/stat -c '%a' "$CONFIG_DIRECTORY" 2>/dev/null)" = 700 ] || fail
[ "$(/usr/bin/stat -c '%u' "$CONFIG_DIRECTORY" 2>/dev/null)" = 0 ] || fail
temporary_config="$(/usr/bin/mktemp "$CONFIG_DIRECTORY/.production-signals.env.XXXXXXXX")" || fail
temporary_service="$(/usr/bin/mktemp "/etc/systemd/system/.$SERVICE_UNIT.XXXXXXXX")" || fail
temporary_timer="$(/usr/bin/mktemp "/etc/systemd/system/.$TIMER_UNIT.XXXXXXXX")" || fail
/usr/bin/chmod 0600 "$temporary_config" || fail
{
  printf 'TARGET_SHA=%s\n' "$TARGET_SHA"
  printf 'OASIS_PRODUCTION_APP_URL=%s\n' "$OASIS_PRODUCTION_APP_URL"
  printf 'BACKUP_ENCRYPTION_KEY_FILE=%s\n' "$BACKUP_ENCRYPTION_KEY_FILE"
  printf 'PRODUCTION_SIGNAL_HEARTBEAT_FILE=%s\n' "$HEARTBEAT_FILE"
  printf 'COMPOSE_FILE=%s\n' "$runtime_current/deploy/v2/docker-compose.yml"
  printf 'ENV_FILE=%s\n' "$REPOSITORY/deploy/v2/.env"
  printf 'BACKUP_DIR=%s\n' "$BACKUP_DIRECTORY"
} >"$temporary_config" || fail

/usr/bin/install -m 0644 \
  "$runtime_current/deploy/v2/systemd/$SERVICE_UNIT" \
  "$temporary_service" || fail
/usr/bin/install -m 0644 \
  "$runtime_current/deploy/v2/systemd/$TIMER_UNIT" \
  "$temporary_timer" || fail
/usr/bin/mv -f "$temporary_service" "/etc/systemd/system/$SERVICE_UNIT" || fail
temporary_service=
/usr/bin/mv -f "$temporary_timer" "/etc/systemd/system/$TIMER_UNIT" || fail
temporary_timer=
/usr/bin/mv -f "$temporary_config" "$CONFIG_FILE" || fail
temporary_config=

/usr/bin/systemd-analyze verify \
  "/etc/systemd/system/$SERVICE_UNIT" \
  "/etc/systemd/system/$TIMER_UNIT" >/dev/null 2>&1 || fail
/usr/bin/systemctl daemon-reload >/dev/null 2>&1 || fail
/usr/bin/systemctl start "$SERVICE_UNIT" >/dev/null 2>&1 || fail
if ! TARGET_SHA="$TARGET_SHA" \
  PRODUCTION_SIGNAL_HEARTBEAT_FILE="$HEARTBEAT_FILE" \
  /usr/bin/node \
    "$runtime_current/deploy/v2/scripts/production-signal-runner.mjs" \
    check >/dev/null 2>&1
then
  fail
fi
/usr/bin/systemctl enable --now "$TIMER_UNIT" >/dev/null 2>&1 || fail
/usr/bin/systemctl is-enabled --quiet "$TIMER_UNIT" || fail
/usr/bin/systemctl is-active --quiet "$TIMER_UNIT" || fail

printf 'PRODUCTION_SIGNAL_SCHEDULER_INSTALLED\n'
