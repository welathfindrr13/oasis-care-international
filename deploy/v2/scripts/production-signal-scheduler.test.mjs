import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const service = fs.readFileSync(
  new URL("../systemd/oasis-production-signals.service", import.meta.url),
  "utf8",
);
const timer = fs.readFileSync(
  new URL("../systemd/oasis-production-signals.timer", import.meta.url),
  "utf8",
);
const installer = fs.readFileSync(
  new URL("./install-production-signal-scheduler.sh", import.meta.url),
  "utf8",
);
const verifier = fs.readFileSync(
  new URL("./verify-production-signal-scheduler.sh", import.meta.url),
  "utf8",
);

test("systemd service runs only the bounded wrapper with private durable state", () => {
  assert.match(service, /^Type=oneshot$/m);
  assert.match(service, /^User=root$/m);
  assert.match(service, /^Group=root$/m);
  assert.match(
    service,
    /^WorkingDirectory=\/usr\/local\/lib\/oasis-production-signals\/current$/m,
  );
  assert.match(
    service,
    /^EnvironmentFile=\/etc\/oasis\/production-signals\.env$/m,
  );
  assert.match(
    service,
    /^ExecStart=\/usr\/bin\/node \/usr\/local\/lib\/oasis-production-signals\/current\/deploy\/v2\/scripts\/production-signal-runner\.mjs run$/m,
  );
  assert.match(service, /^TimeoutStartSec=150$/m);
  assert.match(service, /^StateDirectory=oasis-production-signals$/m);
  assert.match(service, /^StateDirectoryMode=0700$/m);
  assert.match(service, /^UMask=0077$/m);
  assert.match(service, /^ProtectSystem=strict$/m);
  assert.match(service, /^CapabilityBoundingSet=$/m);
  assert.match(service, /^AmbientCapabilities=$/m);
  assert.match(
    service,
    /^ReadWritePaths=\/var\/lib\/oasis-production-signals$/m,
  );
  assert.match(
    service,
    /^ReadOnlyPaths=\/usr\/local\/lib\/oasis-production-signals$/m,
  );
  assert.doesNotMatch(service, /Environment=.*(?:KEY|TOKEN|SECRET|PASSWORD)/i);
  assert.doesNotMatch(service, /(?:bash|sh)\s+-c/);
  assert.doesNotMatch(service, /MemoryDenyWriteExecute=true/);
});

test("systemd timer is persistent and schedules every five minutes", () => {
  assert.match(timer, /^OnCalendar=\*:0\/5$/m);
  assert.match(timer, /^AccuracySec=1s$/m);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /^Unit=oasis-production-signals\.service$/m);
  assert.doesNotMatch(timer, /^OnUnitInactiveSec=/m);
});

test("installer proves exact main revision and private inputs before enabling", () => {
  assert.match(installer, /^REPOSITORY=\/opt\/oasis-care$/m);
  assert.match(installer, /^BACKUP_DIRECTORY=\/var\/backups\/oasis$/m);
  assert.match(installer, /^PATH=\/usr\/sbin:\/usr\/bin:\/sbin:\/bin$/m);
  assert.match(
    installer,
    /unset BASH_ENV ENV CDPATH NODE_OPTIONS NODE_PATH/,
  );
  assert.ok(
    installer.indexOf("unset BASH_ENV ENV CDPATH NODE_OPTIONS NODE_PATH") <
      installer.indexOf("/usr/bin/node --check"),
  );
  assert.match(installer, /^GIT_NO_REPLACE_OBJECTS=1$/m);
  assert.match(installer, /\/usr\/bin\/git --no-replace-objects rev-parse HEAD/);
  assert.match(
    installer,
    /\$\(\/usr\/bin\/git --no-replace-objects rev-parse origin\/main 2>\/dev\/null\)" = "\$TARGET_SHA"/,
  );
  assert.match(installer, /^RUNTIME_ROOT=\/usr\/local\/lib\/oasis-production-signals$/m);
  assert.match(
    installer,
    /^VERIFIER_COMMAND=\/usr\/local\/sbin\/oasis-verify-production-signal-scheduler$/m,
  );
  assert.match(installer, /\/usr\/bin\/git --no-replace-objects show/);
  assert.match(
    installer,
    /"\$runtime_current\/deploy\/v2\/systemd\/\$SERVICE_UNIT"/,
  );
  assert.match(
    installer,
    /"\$runtime_current\/deploy\/v2\/scripts\/verify-production-signal-scheduler\.sh"/,
  );
  assert.match(installer, /stat -c '%a'/);
  assert.match(installer, /stat -c '%u'/);
  assert.match(installer, /\)\" = 600 \] \|\| fail/);
  assert.match(installer, /systemd-analyze verify/);
  assert.match(installer, /systemctl start "\$SERVICE_UNIT"/);
  assert.match(installer, /printf 'BACKUP_DIR=%s\\n' "\$BACKUP_DIRECTORY"/);
  assert.match(
    installer,
    /production-signal-runner\.mjs" \\\n    check >\/dev\/null 2>&1/,
  );
  const startIndex = installer.indexOf('systemctl start "$SERVICE_UNIT"');
  const disableIndex = installer.indexOf(
    'systemctl disable --now "$TIMER_UNIT"',
  );
  const replaceIndex = installer.indexOf(
    'mv -f "$temporary_timer" "/etc/systemd/system/$TIMER_UNIT"',
  );
  const enableIndex = installer.indexOf(
    'systemctl enable --now "$TIMER_UNIT"',
  );
  assert.ok(disableIndex > 0);
  assert.ok(replaceIndex > disableIndex);
  assert.ok(startIndex > 0);
  assert.ok(enableIndex > startIndex);
  assert.doesNotMatch(installer, /set -x|(?:^|\n)\s*(?:env|printenv)\b/);
});

test("installer emits only fixed operational markers", () => {
  const printStatements = [...installer.matchAll(/printf\s+'([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(printStatements, [
    "PRODUCTION_SIGNAL_SCHEDULER_INSTALL_FAILED\\n",
    "TARGET_SHA=%s\\n",
    "OASIS_PRODUCTION_APP_URL=%s\\n",
    "BACKUP_ENCRYPTION_KEY_FILE=%s\\n",
    "PRODUCTION_SIGNAL_HEARTBEAT_FILE=%s\\n",
    "COMPOSE_FILE=%s\\n",
    "ENV_FILE=%s\\n",
    "BACKUP_DIR=%s\\n",
    "PRODUCTION_SIGNAL_SCHEDULER_INSTALLED\\n",
  ]);
  assert.doesNotMatch(
    installer,
    /(?:cat|sed|head|tail|tee)\s+.*(?:\.env|heartbeat|key)/i,
  );
});

test("external verifier fails closed on timer or heartbeat state", () => {
  assert.match(
    verifier,
    /^CONFIG_FILE=\/etc\/oasis\/production-signals\.env$/m,
  );
  assert.match(verifier, /^CONFIG_DIRECTORY=\/etc\/oasis$/m);
  assert.match(
    verifier,
    /unset BASH_ENV ENV CDPATH NODE_OPTIONS NODE_PATH/,
  );
  assert.ok(
    verifier.indexOf("unset BASH_ENV ENV CDPATH NODE_OPTIONS NODE_PATH") <
      verifier.indexOf("/usr/bin/node"),
  );
  assert.match(verifier, /stat -c '%a'/);
  assert.match(verifier, /stat -c '%u'/);
  assert.match(verifier, /\)" = 600 \] \|\| fail/);
  assert.match(verifier, /systemctl is-enabled --quiet "\$TIMER_UNIT"/);
  assert.match(verifier, /systemctl is-active --quiet "\$TIMER_UNIT"/);
  assert.match(verifier, /--property=Result --value/);
  assert.match(verifier, /--property=ExecMainStatus --value/);
  assert.match(verifier, /production-signal-runner\.mjs \\\n  check/);
  assert.doesNotMatch(verifier, /set -x|(?:^|\n)\s*(?:env|printenv)\b/);
  const printStatements = [...verifier.matchAll(/printf\s+'([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(printStatements, [
    "PRODUCTION_SIGNAL_HEARTBEAT_FAILED\\n",
    "PRODUCTION_SIGNAL_HEARTBEAT_OK\\n",
  ]);
});
