#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

fail() {
  printf 'PRODUCTION_SIGNAL_SYSTEMD_VERIFY_FAILED\n' >&2
  exit 1
}

command -v systemd-analyze >/dev/null 2>&1 || fail
temporary_root="$(mktemp -d)" || fail
cleanup() {
  rm -rf "$temporary_root"
}
trap cleanup EXIT

install -d -m 0755 \
  "$temporary_root/etc/systemd/system" \
  "$temporary_root/etc/oasis" \
  "$temporary_root/opt/oasis-care" \
  "$temporary_root/usr/bin" \
  "$temporary_root/usr/local/lib/oasis-production-signals/current/deploy/v2/scripts" \
  || fail
install -m 0644 \
  deploy/v2/systemd/oasis-production-signals.service \
  "$temporary_root/etc/systemd/system/oasis-production-signals.service" \
  || fail
install -m 0644 \
  deploy/v2/systemd/oasis-production-signals.timer \
  "$temporary_root/etc/systemd/system/oasis-production-signals.timer" \
  || fail

cat >"$temporary_root/etc/systemd/system/docker.service" <<'UNIT'
[Unit]
Description=CI-only Docker dependency placeholder

[Service]
Type=oneshot
ExecStart=/usr/bin/true
RemainAfterExit=yes
UNIT
cat >"$temporary_root/etc/systemd/system/sysinit.target" <<'UNIT'
[Unit]
Description=CI-only system initialization target
DefaultDependencies=no
UNIT
cat >"$temporary_root/etc/oasis/production-signals.env" <<'ENVIRONMENT'
TARGET_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
OASIS_PRODUCTION_APP_URL=https://care.example.org
BACKUP_ENCRYPTION_KEY_FILE=/etc/oasis/oasis-backup.key
PRODUCTION_SIGNAL_HEARTBEAT_FILE=/var/lib/oasis-production-signals/heartbeat.json
ENVIRONMENT
printf 'ci-only-key\n' >"$temporary_root/etc/oasis/oasis-backup.key" || fail
cat >"$temporary_root/usr/bin/node" <<'EXECUTABLE'
#!/bin/sh
exit 0
EXECUTABLE
cat >"$temporary_root/usr/bin/true" <<'EXECUTABLE'
#!/bin/sh
exit 0
EXECUTABLE
cat >"$temporary_root/usr/local/lib/oasis-production-signals/current/deploy/v2/scripts/production-signal-runner.mjs" <<'SCRIPT'
// CI-only path placeholder for systemd-analyze.
SCRIPT
chmod 0600 \
  "$temporary_root/etc/oasis/production-signals.env" \
  "$temporary_root/etc/oasis/oasis-backup.key" \
  || fail
chmod 0755 "$temporary_root/usr/bin/node" "$temporary_root/usr/bin/true" || fail
chmod 0400 \
  "$temporary_root/usr/local/lib/oasis-production-signals/current/deploy/v2/scripts/production-signal-runner.mjs" \
  || fail

if ! systemd-analyze --root="$temporary_root" verify \
  oasis-production-signals.service \
  oasis-production-signals.timer >/dev/null 2>&1
then
  fail
fi

printf 'PRODUCTION_SIGNAL_SYSTEMD_VERIFY_OK\n'
