import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./tenant-nullability-dry-run.yml', import.meta.url), 'utf8');
const apiDockerfile = fs.readFileSync(new URL('../../apps/api/Dockerfile', import.meta.url), 'utf8');
const scpLines = workflow
  .split('\n')
  .filter((line) => /\bscp\b/.test(line))
  .join('\n');

test('tenant nullability dry-run workflow is manual and uses fixed staging SSH secrets', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /OASIS_VPS_SSH_KEY/);
  assert.match(workflow, /OASIS_VPS_HOST/);
  assert.match(workflow, /OASIS_VPS_USER/);
  assert.doesNotMatch(workflow, /inputs:/);
});

test('tenant nullability dry-run workflow cannot deploy rebuild restart migrate or backfill', () => {
  assert.doesNotMatch(workflow, /git pull/);
  assert.doesNotMatch(workflow, /git checkout/);
  assert.doesNotMatch(workflow, /docker compose .* up\b/);
  assert.doesNotMatch(workflow, /docker compose .* build\b/);
  assert.doesNotMatch(workflow, /docker compose .* restart\b/);
  assert.doesNotMatch(workflow, /prisma migrate|migrate deploy|db push|backfill/i);
});

test('tenant nullability dry-run workflow runs only the fixed eligible-table gate script', () => {
  assert.match(workflow, /scripts\/release\/tenant-nullability-dry-run\.mjs/);
  assert.match(workflow, /docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml run --rm --no-deps --entrypoint sh/);
  assert.match(workflow, /--fail-on-null/);
  assert.match(workflow, /--exclude AuditLog/);
  assert.match(workflow, /Excluded models: AuditLog/);
  assert.doesNotMatch(workflow, /workflow_dispatch:[\s\S]*inputs:/);
});

test('tenant nullability dry-run workflow uses the reviewed checkout script', () => {
  const checkoutIndex = workflow.indexOf('uses: actions/checkout@');
  const localCheckIndex = workflow.indexOf('test -f scripts/release/tenant-nullability-dry-run.mjs');
  const remoteDirIndex = workflow.indexOf('remote_script_dir="$(ssh -i ~/.ssh/oasis_vps -o BatchMode=yes "$OASIS_VPS_USER@$OASIS_VPS_HOST"');
  const scpIndex = workflow.indexOf('scp -i ~/.ssh/oasis_vps -o BatchMode=yes scripts/release/tenant-nullability-dry-run.mjs');
  const composeIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env');

  assert.notEqual(checkoutIndex, -1);
  assert.notEqual(localCheckIndex, -1);
  assert.notEqual(remoteDirIndex, -1);
  assert.notEqual(scpIndex, -1);
  assert.notEqual(composeIndex, -1);
  assert(checkoutIndex < localCheckIndex);
  assert(localCheckIndex < remoteDirIndex);
  assert(remoteDirIndex < scpIndex);
  assert(scpIndex < composeIndex);
});

test('tenant nullability dry-run workflow copies only the reviewed dry-run script', () => {
  assert.match(
    workflow,
    /scp -i ~\/\.ssh\/oasis_vps -o BatchMode=yes scripts\/release\/tenant-nullability-dry-run\.mjs "\$OASIS_VPS_USER@\$OASIS_VPS_HOST:\$remote_script_dir\/tenant-nullability-dry-run\.mjs"/,
  );
  assert.match(workflow, /chmod 0444 '\$remote_script_dir\/tenant-nullability-dry-run\.mjs'/);
  assert.match(workflow, /chmod 0555 '\$remote_script_dir'/);
  assert.doesNotMatch(scpLines, /deploy\/v2\/\.env/);
  assert.doesNotMatch(scpLines, /package\.json/);
  assert.doesNotMatch(scpLines, /(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)/);
  assert.doesNotMatch(scpLines, /(dist|build|\.next|apps|libs)\//);
  assert.doesNotMatch(scpLines, /\s\.\s/);
  assert.doesNotMatch(scpLines, /\* /);
});

test('tenant nullability dry-run workflow mounts only the remote script directory read-only', () => {
  assert.match(workflow, /-v "\$remote_script_dir:\/app\/scripts\/release:ro"/);
  assert.doesNotMatch(workflow, /-v "\$PWD\/scripts\/release:\/app\/scripts\/release:ro"/);
  assert.doesNotMatch(workflow, /-v "\$PWD:\/app/);
  assert.doesNotMatch(workflow, /\/opt\/oasis-care\/scripts\/release/);
});

test('tenant nullability dry-run workflow does not print env files or secrets', () => {
  assert.doesNotMatch(workflow, /cat deploy\/v2\/\.env/);
  assert.doesNotMatch(workflow, /\bprintenv\b/);
  assert.doesNotMatch(workflow, /\benv\b\s*(\||>|$)/);
  assert.doesNotMatch(workflow, /DATABASE_URL|CLERK_SECRET_KEY|JWT_SECRET|NEXTAUTH_SECRET/);
});

test('tenant nullability dry-run workflow validates sanitized output shape', () => {
  assert.match(workflow, /Tenant nullability dry-run/);
  assert.match(workflow, /Excluded models: AuditLog/);
  assert.match(workflow, /No data changed\./);
  assert.match(workflow, /TENANT_NULLABILITY_DRY_RUN_REPORT_START/);
  assert.match(workflow, /TENANT_NULLABILITY_DRY_RUN_REPORT_END/);
  assert.match(workflow, /PASS: tenant nullability eligible-table gate passed\./);
  assert.match(workflow, /FAIL: tenant nullability eligible-table gate failed\./);
  assert.match(workflow, /Tenant nullability dry-run failed with unsafe output suppressed\./);
  assert.match(workflow, /Tenant nullability dry-run failed before report generation\./);
  assert.doesNotMatch(workflow, /Unsafe tenant nullability dry-run output; refusing to print report\./);
  assert.match(workflow, /grep -E/);
});

test('tenant nullability dry-run workflow separates report output from transport diagnostics', () => {
  assert.match(workflow, /report_file="\$\(mktemp\)"/);
  assert.match(workflow, /diagnostic_file="\$\(mktemp\)"/);
  assert.match(workflow, /cleanup\(\) \{/);
  assert.match(workflow, /rm -f "\$report_file" "\$diagnostic_file"/);
  assert.match(workflow, /trap cleanup EXIT/);
  assert.match(workflow, /ssh[\s\S]*<<'REMOTE'\s*> "\$report_file" 2>> "\$diagnostic_file"/);
  assert.match(workflow, /remote_tmp="\$\(mktemp -d\)"/);
  assert.match(workflow, /trap 'rm -rf "\$remote_tmp"' EXIT/);
  assert.doesNotMatch(workflow, /-v "\$remote_tmp:\/tmp\/tenant-nullability:rw"/);
  assert.match(
    workflow,
    /container_report_file="\$\(mktemp \/tmp\/tenant-nullability-report\.XXXXXX\)"/,
  );
  assert.match(
    workflow,
    /node \/app\/scripts\/release\/tenant-nullability-dry-run\.mjs --fail-on-null --exclude AuditLog > "\$container_report_file"/,
  );
  assert.match(workflow, /cat "\$container_report_file"/);
  assert.match(workflow, /> "\$remote_tmp\/report\.out" 2> "\$remote_tmp\/transport\.err"/);
  assert.match(workflow, /cat "\$remote_tmp\/report\.out"/);
  assert.match(workflow, /status=\$\?/);
  assert.match(workflow, /exit "\$status"/);
  assert.doesNotMatch(workflow, /tenant-nullability-dry-run\.mjs --fail-on-null --exclude AuditLog\s+2>&1/);
  assert.doesNotMatch(workflow, /<<'REMOTE'\s*> "\$report_file" 2>&1/);
  assert.doesNotMatch(workflow, /remote_report="\$\(/);
});

test('tenant nullability dry-run workflow preserves report when dry-run exits nonzero', () => {
  const containerReportNeedle = 'container_report_file="$(mktemp /tmp/tenant-nullability-report.XXXXXX)"';
  const nodeCommandNeedle =
    'node /app/scripts/release/tenant-nullability-dry-run.mjs --fail-on-null --exclude AuditLog > "$container_report_file"';
  const nodeStatusNeedle = 'node_status="$?"';
  const catReportNeedle = 'cat "$container_report_file"';
  const exitNodeStatusNeedle = 'exit "$node_status"';

  const containerReportIndex = workflow.indexOf(containerReportNeedle);
  const nodeCommandIndex = workflow.indexOf(nodeCommandNeedle);
  const nodeStatusIndex = workflow.indexOf(nodeStatusNeedle);
  const catReportIndex = workflow.indexOf(catReportNeedle);
  const exitNodeStatusIndex = workflow.indexOf(exitNodeStatusNeedle);
  const innerShellStartIndex = workflow.lastIndexOf("api -lc '", containerReportIndex);
  const innerShellBeforeNode = workflow.slice(innerShellStartIndex, nodeCommandIndex);

  assert.notEqual(containerReportIndex, -1);
  assert.notEqual(nodeCommandIndex, -1);
  assert.notEqual(nodeStatusIndex, -1);
  assert.notEqual(catReportIndex, -1);
  assert.notEqual(exitNodeStatusIndex, -1);
  assert.match(innerShellBeforeNode, /\n\s*set -u\n/);
  assert.doesNotMatch(innerShellBeforeNode, /\n\s*set -eu\b/);
  assert(containerReportIndex < nodeCommandIndex);
  assert(nodeCommandIndex < nodeStatusIndex);
  assert(nodeStatusIndex < catReportIndex);
  assert(catReportIndex < exitNodeStatusIndex);
  assert.match(
    workflow,
    /set \+e\s*\n\s*node \/app\/scripts\/release\/tenant-nullability-dry-run\.mjs --fail-on-null --exclude AuditLog > "\$container_report_file"\s*\n\s*node_status="\$\?"\s*\n\s*set -e/,
  );
});

test('tenant nullability dry-run workflow avoids host chown and world-writable report paths', () => {
  const containerReportIndex = workflow.indexOf('mktemp /tmp/tenant-nullability-report.XXXXXX');
  const composeIndex = workflow.indexOf('docker compose --env-file deploy/v2/.env');

  assert.match(apiDockerfile, /addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs/);
  assert.match(apiDockerfile, /USER nestjs/);
  assert.notEqual(containerReportIndex, -1);
  assert.notEqual(composeIndex, -1);
  assert(
    composeIndex < containerReportIndex,
    'tenant report must be created inside the API container rather than a host bind mount',
  );
  assert.doesNotMatch(workflow, /\bchown\b/);
  assert.doesNotMatch(workflow, /chmod -R 0?77[0-7]/);
  assert.doesNotMatch(workflow, /chmod 0?777/);
  assert.doesNotMatch(workflow, /chmod 0777 "\$remote_tmp"/);
  assert.doesNotMatch(workflow, /chmod 0?77[0-7] "\$remote_tmp"/);
  assert.doesNotMatch(workflow, /-v "\$remote_tmp:\/tmp\/tenant-nullability:rw"/);
  assert.match(workflow, /trap 'rm -rf "\$remote_tmp"' EXIT/);
});

test('tenant nullability dry-run workflow restores temp script directory for cleanup', () => {
  const restoreIndex = workflow.indexOf('chmod u+w \'$remote_script_dir\' 2>/dev/null || true');
  const removeIndex = workflow.indexOf('rm -rf \'$remote_script_dir\'');

  assert.notEqual(restoreIndex, -1);
  assert.notEqual(removeIndex, -1);
  assert(restoreIndex < removeIndex);
  assert.match(workflow, /chmod 0555 '\$remote_script_dir'/);
  assert.match(workflow, /chmod 0444 '\$remote_script_dir\/tenant-nullability-dry-run\.mjs'/);
});

test('tenant nullability dry-run workflow emits report only after validation', () => {
  const unsafeCheckIndex = workflow.indexOf("grep -Eiq '://|bearer|secret|token|cookie|jwt|authorization|password|");
  const delimiterIndex = workflow.indexOf('TENANT_NULLABILITY_DRY_RUN_REPORT_START');

  assert.notEqual(unsafeCheckIndex, -1);
  assert.notEqual(delimiterIndex, -1);
  assert(unsafeCheckIndex < delimiterIndex, 'unsafe output check must run before report delimiter is printed');
  assert.match(workflow, /sanitized_report_lines=/);
  assert.match(workflow, /\^Tenant nullability dry-run\$/);
  assert.match(workflow, /\^No data changed\\\.\$/);
});

test('tenant nullability dry-run workflow fails on unallowlisted output', () => {
  const unallowlistedCheckIndex = workflow.indexOf('[ "$unallowlisted_output" -ne 0 ]');
  const delimiterIndex = workflow.indexOf('TENANT_NULLABILITY_DRY_RUN_REPORT_START');

  assert.match(workflow, /unallowlisted_output=0/);
  assert.match(workflow, /""\)\s*;;/);
  assert.match(workflow, /\*\)\s*unallowlisted_output=1\s*;;/);
  assert.notEqual(unallowlistedCheckIndex, -1);
  assert.notEqual(delimiterIndex, -1);
  assert(
    unallowlistedCheckIndex < delimiterIndex,
    'unallowlisted output must fail before report delimiters are printed',
  );
  assert.match(workflow, /Tenant nullability dry-run failed with unsafe output suppressed\./);
  assert.match(workflow, /if \[ "\$status" -eq 0 \]; then\s*exit 1/);
});

test('tenant nullability dry-run workflow reports only sanitized rejection classes', () => {
  assert.match(workflow, /Tenant nullability dry-run rejected output class: unsafe pattern\./);
  assert.match(workflow, /Tenant nullability dry-run rejected output class: malformed count line\./);
  assert.match(workflow, /Tenant nullability dry-run rejected output class: unallowlisted line\./);
  assert.doesNotMatch(workflow, /printf '%s\\n' "\$line" >&2/);
  assert.doesNotMatch(workflow, /cat "\$report_file"/);
  assert.doesNotMatch(workflow, /cat "\$diagnostic_file"/);
  assert.doesNotMatch(workflow, /cat "\$remote_tmp\/transport\.(out|err)"/);
});

test('tenant nullability dry-run workflow classifies no-report failures without raw diagnostics', () => {
  const diagnosticClassIndex = workflow.indexOf('Tenant nullability dry-run diagnostic class:');
  const missingReportIndex = workflow.indexOf('Tenant nullability dry-run failed before report generation.');
  const delimiterIndex = workflow.indexOf('TENANT_NULLABILITY_DRY_RUN_REPORT_START');

  assert.match(workflow, /Tenant nullability dry-run diagnostic class: remote command produced no report\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: empty report output\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: container command produced no stdout\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: container command did not reach node start\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: node command produced empty report\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: node command exited before report output\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: report missing required header\./);
  assert.match(workflow, /Tenant nullability dry-run diagnostic class: report missing completion marker\./);
  assert.match(workflow, /\[ -s "\$diagnostic_file" \]/);
  assert.notEqual(diagnosticClassIndex, -1);
  assert.notEqual(missingReportIndex, -1);
  assert.notEqual(delimiterIndex, -1);
  assert(
    diagnosticClassIndex < delimiterIndex,
    'diagnostic class must be emitted before report delimiters can be printed',
  );
  assert(
    missingReportIndex < delimiterIndex,
    'missing-report failures must stop before report delimiters are printed',
  );
  assert.doesNotMatch(workflow, /printf '%s\\n' "\$diagnostic_file"/);
  assert.doesNotMatch(workflow, /cat "\$diagnostic_file"/);
  assert.doesNotMatch(workflow, /cat "\$remote_tmp\/transport\.(out|err)"/);
});

test('tenant nullability dry-run workflow classifies docker startup failures separately', () => {
  const dockerUnavailableIndex = workflow.indexOf('TENANT_NULLABILITY_DIAGNOSTIC: docker unavailable');
  const composeUnavailableIndex = workflow.indexOf('TENANT_NULLABILITY_DIAGNOSTIC: docker compose unavailable');
  const composeConfigFailedIndex = workflow.indexOf('TENANT_NULLABILITY_DIAGNOSTIC: docker compose config failed');
  const composeRunNoContainerIndex = workflow.indexOf(
    'Tenant nullability dry-run diagnostic class: docker compose run did not start container command.',
  );
  const containerNoNodeIndex = workflow.indexOf(
    'Tenant nullability dry-run diagnostic class: container command did not reach node start.',
  );

  assert.notEqual(dockerUnavailableIndex, -1);
  assert.notEqual(composeUnavailableIndex, -1);
  assert.notEqual(composeConfigFailedIndex, -1);
  assert.notEqual(composeRunNoContainerIndex, -1);
  assert.notEqual(containerNoNodeIndex, -1);
  assert.match(workflow, /command -v docker >\/dev\/null 2>&1/);
  assert.match(workflow, /docker compose version >\/dev\/null 2>&1/);
  assert.match(
    workflow,
    /docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml config --quiet >\/dev\/null 2>> "\$remote_tmp\/transport\.err"/,
  );
  assert.match(workflow, /saw_docker_command_starting=1/);
  assert.match(workflow, /saw_container_command_started=1/);
  assert.match(workflow, /saw_node_command_started=1/);
  assert(
    composeRunNoContainerIndex < containerNoNodeIndex,
    'docker compose startup failure should be classified before container-started pre-node failure',
  );
});

test('tenant nullability dry-run workflow reserves container no-node class for started containers', () => {
  const composeRunConditionIndex = workflow.indexOf(
    'elif [ "$saw_docker_command_starting" -ne 0 ] && [ "$saw_container_command_started" -eq 0 ]; then',
  );
  const composeRunClassIndex = workflow.indexOf(
    "printf 'Tenant nullability dry-run diagnostic class: docker compose run did not start container command.\\n' >&2",
  );
  const containerNoNodeConditionIndex = workflow.indexOf(
    'elif [ "$saw_container_command_started" -ne 0 ] && [ "$saw_node_command_started" -eq 0 ]; then',
  );
  const containerNoNodeClassIndex = workflow.indexOf(
    "printf 'Tenant nullability dry-run diagnostic class: container command did not reach node start.\\n' >&2",
  );

  assert.notEqual(composeRunConditionIndex, -1);
  assert.notEqual(composeRunClassIndex, -1);
  assert.notEqual(containerNoNodeConditionIndex, -1);
  assert.notEqual(containerNoNodeClassIndex, -1);
  assert(composeRunConditionIndex < composeRunClassIndex);
  assert(containerNoNodeConditionIndex < containerNoNodeClassIndex);
  assert.doesNotMatch(
    workflow,
    /elif \[ "\$saw_container_command_started" -eq 0 \]; then\s*printf 'Tenant nullability dry-run diagnostic class: container command did not reach node start\\\.\\n' >&2/,
  );
});

test('tenant nullability dry-run workflow emits class-only diagnostic markers for empty report paths', () => {
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: remote command started/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: docker command starting/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: docker command exited status=%s/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: container command started/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: node command started/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: node command exited status=%s/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: node command produced empty report/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: container report cat attempted/);
  assert.match(workflow, /TENANT_NULLABILITY_DIAGNOSTIC: container command produced no stdout/);
  assert.match(workflow, /saw_container_command_started=0/);
  assert.match(workflow, /saw_node_command_started=0/);
  assert.match(workflow, /saw_node_command_empty_report=0/);
  assert.match(workflow, /saw_container_report_cat_attempted=0/);
  assert.match(workflow, /saw_container_stdout_empty=0/);
});

test('tenant nullability dry-run workflow consumes diagnostic markers before report validation', () => {
  const markerCaseIndex = workflow.indexOf('"TENANT_NULLABILITY_DIAGNOSTIC: remote command started"');
  const headerCaseIndex = workflow.indexOf('"Tenant nullability dry-run"|"Excluded models: AuditLog"|"No data changed.")');
  const noReportIndex = workflow.indexOf('[ "$sanitized_report_lines" -eq 0 ]');
  const delimiterIndex = workflow.indexOf('TENANT_NULLABILITY_DRY_RUN_REPORT_START');
  const nodeStatusPatternIndex = workflow.indexOf('^TENANT_NULLABILITY_DIAGNOSTIC: (node|docker) command exited status=[0-9]+$');

  assert.notEqual(markerCaseIndex, -1);
  assert.notEqual(headerCaseIndex, -1);
  assert.notEqual(noReportIndex, -1);
  assert.notEqual(delimiterIndex, -1);
  assert.notEqual(nodeStatusPatternIndex, -1);
  assert(markerCaseIndex < headerCaseIndex);
  assert(headerCaseIndex < noReportIndex);
  assert(noReportIndex < delimiterIndex);
  assert.match(workflow, /sanitized_report="\$\{sanitized_report\}\$\{line\}"/);
  assert.doesNotMatch(workflow, /sanitized_report=.*TENANT_NULLABILITY_DIAGNOSTIC/);
});
