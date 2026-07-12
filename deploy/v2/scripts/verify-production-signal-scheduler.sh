#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
unset BASH_ENV ENV CDPATH 2>/dev/null || true

CONFIG_FILE=/etc/oasis/production-signals.env
CONFIG_DIRECTORY=/etc/oasis
SERVICE_UNIT=oasis-production-signals.service
TIMER_UNIT=oasis-production-signals.timer

fail() {
  printf 'PRODUCTION_SIGNAL_HEARTBEAT_FAILED\n' >&2
  exit 1
}

[ "$EUID" -eq 0 ] || fail
[ -d "$CONFIG_DIRECTORY" ] || fail
[ ! -L "$CONFIG_DIRECTORY" ] || fail
[ "$(/usr/bin/stat -c '%a' "$CONFIG_DIRECTORY" 2>/dev/null)" = 700 ] || fail
[ "$(/usr/bin/stat -c '%u' "$CONFIG_DIRECTORY" 2>/dev/null)" = 0 ] || fail
[ -f "$CONFIG_FILE" ] || fail
[ ! -L "$CONFIG_FILE" ] || fail
[ "$(/usr/bin/stat -c '%a' "$CONFIG_FILE" 2>/dev/null)" = 600 ] || fail
/usr/bin/systemctl is-enabled --quiet "$TIMER_UNIT" >/dev/null 2>&1 || fail
/usr/bin/systemctl is-active --quiet "$TIMER_UNIT" >/dev/null 2>&1 || fail
[ "$(/usr/bin/systemctl show "$SERVICE_UNIT" --property=Result --value 2>/dev/null)" = success ] || fail
[ "$(/usr/bin/systemctl show "$SERVICE_UNIT" --property=ExecMainStatus --value 2>/dev/null)" = 0 ] || fail

set -a
if ! source "$CONFIG_FILE" 2>/dev/null; then
  set +a
  fail
fi
set +a

if ! /usr/bin/node \
  /usr/local/lib/oasis-production-signals/current/deploy/v2/scripts/production-signal-runner.mjs \
  check >/dev/null 2>&1
then
  fail
fi

printf 'PRODUCTION_SIGNAL_HEARTBEAT_OK\n'
