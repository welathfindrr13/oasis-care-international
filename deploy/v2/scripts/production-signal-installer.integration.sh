#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'PRODUCTION_SIGNAL_INSTALLER_INTEGRATION_FAILED\n' >&2
  exit 1
}

[ "$EUID" -eq 0 ] || fail
[ -d /source ] || fail
export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null 2>&1 || fail
apt-get install -y git >/dev/null 2>&1 || fail

rm -rf /opt/oasis-care /etc/oasis /usr/local/lib/oasis-production-signals
rm -f /etc/systemd/system/oasis-production-signals.service
rm -f /etc/systemd/system/oasis-production-signals.timer
install -d -m 0755 /opt/oasis-care /secure /etc/systemd/system

while IFS= read -r source_path; do
  [ -n "$source_path" ] || fail
  destination=/opt/oasis-care/$source_path
  install -d -m 0755 "$(dirname "$destination")" || fail
  install -m 0644 "/source/$source_path" "$destination" || fail
done <<'SOURCE_FILES'
.github/workflows/revision-proof.mjs
deploy/v2/Caddyfile
deploy/v2/docker-compose.yml
deploy/v2/scripts/backup-crypto.mjs
deploy/v2/scripts/install-production-signal-scheduler.sh
deploy/v2/scripts/production-signal-runner.mjs
deploy/v2/scripts/production-signals.mjs
deploy/v2/scripts/verify-production-signal-scheduler.sh
deploy/v2/systemd/oasis-production-signals.service
deploy/v2/systemd/oasis-production-signals.timer
SOURCE_FILES
chmod 0755 /opt/oasis-care/deploy/v2/scripts/install-production-signal-scheduler.sh
chmod 0755 /opt/oasis-care/deploy/v2/scripts/verify-production-signal-scheduler.sh

cd /opt/oasis-care || fail
/usr/bin/git init -q || fail
/usr/bin/git config user.name CI
/usr/bin/git config user.email ci@example.invalid
/usr/bin/git add . || fail
/usr/bin/git commit -qm scheduler-test || fail
/usr/bin/git branch -M main || fail
target_sha=$(/usr/bin/git rev-parse HEAD) || fail
/usr/bin/git update-ref refs/remotes/origin/main "$target_sha" || fail

printf '\n// HOSTILE_REPLACEMENT_RUNTIME\n' \
  >>deploy/v2/scripts/production-signal-runner.mjs
/usr/bin/git add deploy/v2/scripts/production-signal-runner.mjs || fail
/usr/bin/git commit -qm hostile-replacement || fail
hostile_sha=$(/usr/bin/git rev-parse HEAD) || fail
/usr/bin/git replace "$target_sha" "$hostile_sha" || fail
/usr/bin/git --no-replace-objects reset --hard "$target_sha" >/dev/null || fail

printf 'test-only-env\n' >deploy/v2/.env
printf 'test-only-key\n' >/secure/oasis-backup.key
chmod 0600 deploy/v2/.env /secure/oasis-backup.key

cat >/usr/bin/node <<'MOCK'
#!/bin/sh
exit 0
MOCK
cat >/usr/bin/docker <<'MOCK'
#!/bin/sh
exit 0
MOCK
cat >/usr/bin/systemd-analyze <<'MOCK'
#!/bin/sh
exit 0
MOCK
cat >/usr/bin/systemctl <<'MOCK'
#!/bin/sh
printf '%s\n' "$*" >>/tmp/oasis-systemctl.log
if [ "$1" = show ]; then
  case "$*" in
    *ExecMainStatus*)
      set +u
      value=$MOCK_EXEC_STATUS
      set -u
      [ -n "$value" ] || value=0
      printf '%s\n' "$value"
      ;;
    *)
      set +u
      value=$MOCK_SERVICE_RESULT
      set -u
      [ -n "$value" ] || value=success
      printf '%s\n' "$value"
      ;;
  esac
  exit 0
fi
set +u
fail_start=$MOCK_FAIL_START
set -u
if [ "$1" = start ] && [ "$fail_start" = 1 ]; then
  exit 1
fi
exit 0
MOCK
chmod 0755 /usr/bin/node /usr/bin/docker /usr/bin/systemd-analyze /usr/bin/systemctl

run_install() {
  env \
    "TARGET_SHA=$target_sha" \
    OASIS_PRODUCTION_APP_URL=https://care.example.org \
    BACKUP_ENCRYPTION_KEY_FILE=/secure/oasis-backup.key \
    /opt/oasis-care/deploy/v2/scripts/install-production-signal-scheduler.sh
}

: >/tmp/oasis-systemctl.log
run_install >/tmp/install.stdout 2>/tmp/install.stderr || fail
[ "$(cat /tmp/install.stdout)" = PRODUCTION_SIGNAL_SCHEDULER_INSTALLED ] || fail
[ ! -s /tmp/install.stderr ] || fail
[ -L /usr/local/lib/oasis-production-signals/current ] || fail
if grep -q HOSTILE_REPLACEMENT_RUNTIME \
  /usr/local/lib/oasis-production-signals/current/deploy/v2/scripts/production-signal-runner.mjs
then
  fail
fi
[ -x /usr/local/sbin/oasis-verify-production-signal-scheduler ] || fail
[ -f /etc/systemd/system/oasis-production-signals.service ] || fail
grep -qx 'start oasis-production-signals.service' /tmp/oasis-systemctl.log || fail
grep -qx 'enable --now oasis-production-signals.timer' /tmp/oasis-systemctl.log || fail

: >/tmp/oasis-systemctl.log
run_install >/tmp/install.stdout 2>/tmp/install.stderr || fail
disable_line=$(grep -n 'disable --now oasis-production-signals.timer' /tmp/oasis-systemctl.log | cut -d: -f1)
start_line=$(grep -n 'start oasis-production-signals.service' /tmp/oasis-systemctl.log | cut -d: -f1)
enable_line=$(grep -n 'enable --now oasis-production-signals.timer' /tmp/oasis-systemctl.log | cut -d: -f1)
[ "$disable_line" -lt "$start_line" ] || fail
[ "$start_line" -lt "$enable_line" ] || fail

: >/tmp/oasis-systemctl.log
export MOCK_FAIL_START=1
set +e
run_install >/tmp/install.stdout 2>/tmp/install.stderr
install_status=$?
set -e
unset MOCK_FAIL_START
[ "$install_status" -ne 0 ] || fail
[ "$(cat /tmp/install.stderr)" = PRODUCTION_SIGNAL_SCHEDULER_INSTALL_FAILED ] || fail
grep -qx 'disable --now oasis-production-signals.timer' /tmp/oasis-systemctl.log || fail
if grep -q 'enable --now oasis-production-signals.timer' /tmp/oasis-systemctl.log; then
  fail
fi

export MOCK_SERVICE_RESULT=failed
export MOCK_EXEC_STATUS=1
set +e
/usr/local/sbin/oasis-verify-production-signal-scheduler \
  >/tmp/verify.stdout 2>/tmp/verify.stderr
verify_status=$?
set -e
unset MOCK_SERVICE_RESULT MOCK_EXEC_STATUS
[ "$verify_status" -ne 0 ] || fail
[ ! -s /tmp/verify.stdout ] || fail
[ "$(cat /tmp/verify.stderr)" = PRODUCTION_SIGNAL_HEARTBEAT_FAILED ] || fail

printf 'PRODUCTION_SIGNAL_INSTALLER_INTEGRATION_OK\n'
