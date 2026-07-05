import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./tenant-nullability-dry-run.yml', import.meta.url), 'utf8');
const apiDockerfile = fs.readFileSync(new URL('../../apps/api/Dockerfile', import.meta.url), 'utf8');

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
  assert.match(workflow, /trap 'rm -f "\$report_file" "\$diagnostic_file"' EXIT/);
  assert.match(workflow, /ssh[\s\S]*<<'REMOTE'\s*> "\$report_file" 2> "\$diagnostic_file"/);
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
  assert.doesNotMatch(workflow, /chmod 0777 "\$remote_tmp"/);
  assert.doesNotMatch(workflow, /chmod 0?77[0-7] "\$remote_tmp"/);
  assert.doesNotMatch(workflow, /-v "\$remote_tmp:\/tmp\/tenant-nullability:rw"/);
  assert.match(workflow, /trap 'rm -rf "\$remote_tmp"' EXIT/);
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
