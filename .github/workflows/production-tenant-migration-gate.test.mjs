import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(
  new URL('./production-tenant-migration-gate.yml', import.meta.url),
  'utf8',
);

const migrationName = '20260707090000_tenant_organization_not_null';
const migrationPath =
  'libs/db/prisma/migrations/20260707090000_tenant_organization_not_null/migration.sql';
const approvalToken = 'APPROVE_20260707090000_TENANT_ORGANIZATION_NOT_NULL_PRODUCTION';

function workflowSlice(start, end) {
  const startIndex = workflow.indexOf(start);
  const endIndex = workflow.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return workflow.slice(startIndex, endIndex);
}

test('production tenant migration gate is manual only with required approval inputs', () => {
  assert.match(workflow, /^name: Production Tenant Migration Gate/m);
  assert.match(workflow, /^on:\n\s+workflow_dispatch:\n\s+inputs:/m);
  assert.match(workflow, /expected_production_sha:/);
  assert.match(workflow, /production_migration_approval:/);
  assert.match(workflow, /required: true/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.doesNotMatch(workflow, /\bschedule:/);
});

test('production tenant migration gate serializes production mutation runs', () => {
  assert.match(workflow, /concurrency:\s*\n\s*group: production-vps-mutation\s*\n\s*cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /group: staging-vps-mutation/);
});

test('production workflow uses production-specific secrets and marker only', () => {
  assert.match(workflow, /OASIS_PRODUCTION_VPS_HOST/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_USER/);
  assert.match(workflow, /OASIS_PRODUCTION_VPS_SSH_KEY/);
  assert.doesNotMatch(workflow, /\bOASIS_VPS_HOST\b|\bOASIS_VPS_USER\b|\bOASIS_VPS_SSH_KEY\b/);
  assert.match(workflow, /\/etc\/oasis\/production-deploy-target-class/);
  assert.doesNotMatch(workflow, /\/etc\/oasis\/deploy-target-class/);
});

test('production target and SHA proof happen before dry-run pending proof and migration', () => {
  const markerIndex = workflow.indexOf('/etc/oasis/production-deploy-target-class');
  const productionLabelIndex = workflow.indexOf('DEPLOY_TARGET_PRODUCTION');
  const unknownLabelIndex = workflow.indexOf('DEPLOY_TARGET_UNKNOWN');
  const notProductionLabelIndex = workflow.indexOf('DEPLOY_TARGET_NOT_PRODUCTION');
  const shaOkIndex = workflow.indexOf('PRODUCTION_CODE_SHA_OK');
  const gateCallIndex = workflow.lastIndexOf('\n          run_remote_gate');
  const preDryRunCallIndex = workflow.lastIndexOf('\n          run_tenant_dry_run pre');
  const pendingProofCallIndex = workflow.lastIndexOf('\n          prove_pending_migration_set');
  const migrateCallIndex = workflow.lastIndexOf('\n          run_single_migration');

  assert.notEqual(markerIndex, -1);
  assert.notEqual(productionLabelIndex, -1);
  assert.notEqual(unknownLabelIndex, -1);
  assert.notEqual(notProductionLabelIndex, -1);
  assert.notEqual(shaOkIndex, -1);
  assert(gateCallIndex < preDryRunCallIndex, 'target/SHA proof must happen before dry-run');
  assert(gateCallIndex < pendingProofCallIndex, 'target/SHA proof must happen before pending proof');
  assert(gateCallIndex < migrateCallIndex, 'target/SHA proof must happen before migration');
  assert.match(workflow, /if \[ "\$target_class" = "production" \]; then/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_PRODUCTION\\n'/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_UNKNOWN\\n' >&2/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_NOT_PRODUCTION\\n' >&2/);
  assert.match(workflow, /PRODUCTION_CODE_SHA_MISMATCH/);
  assert.doesNotMatch(workflow, /printf .*target_class|echo .*target_class|printf .*current_sha|echo .*current_sha/);
});

test('production migration file and tenant dry-runs are gated safely', () => {
  const preDryRunIndex = workflow.lastIndexOf('\n          run_tenant_dry_run pre');
  const pendingProofIndex = workflow.lastIndexOf('\n          prove_pending_migration_set');
  const migrateIndex = workflow.lastIndexOf('\n          run_single_migration');
  const appliedIndex = workflow.lastIndexOf('\n          prove_migration_applied');
  const postDryRunIndex = workflow.lastIndexOf('\n          run_tenant_dry_run post');

  assert.match(workflow, new RegExp(`test -f ${migrationPath.replaceAll('/', '\\/')}`));
  assert.match(workflow, /MIGRATION_FILE_PRESENT/);
  assert.match(workflow, /MIGRATION_FILE_MISSING/);
  assert(preDryRunIndex < pendingProofIndex, 'pre dry-run before pending proof');
  assert(pendingProofIndex < migrateIndex, 'pending proof before migration');
  assert(migrateIndex < appliedIndex, 'migration before applied proof');
  assert(appliedIndex < postDryRunIndex, 'applied proof before post dry-run');
  assert.match(workflow, /--fail-on-null --exclude AuditLog/);
  assert.match(workflow, /printf 'TENANT_NULLABILITY_%s_PASS\\n' "\$phase"/);
  assert.match(workflow, /\n          run_tenant_dry_run pre\n/);
  assert.match(workflow, /\n          run_tenant_dry_run post\n/);
});

test('pending migration proof and approval token gate production migration', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );
  const migrationRunner = workflowSlice(
    'run_single_migration() {',
    '\n          prove_migration_applied() {',
  );

  assert.match(pendingProof, new RegExp(`PENDING_MIGRATION_SET_EXACT: ${migrationName}`));
  assert.match(pendingProof, new RegExp(`MIGRATION_GATE_APPROVED="${migrationName}"`));
  assert.match(workflow, new RegExp(`REQUIRED_APPROVAL_TOKEN: ${approvalToken}`));
  assert.match(workflow, /\[ "\$PRODUCTION_MIGRATION_APPROVAL" != "\$REQUIRED_APPROVAL_TOKEN" \]/);
  assert.match(workflow, /PRODUCTION_MIGRATION_APPROVAL_MISMATCH/);
  assert.match(migrationRunner, new RegExp(`\\[ "\\$\\{MIGRATION_GATE_APPROVED:-\\}" != "${migrationName}" \\]`));
  assert.match(migrationRunner, /MIGRATION_GATE_NOT_APPROVED/);
  assert(
    migrationRunner.indexOf('MIGRATION_GATE_NOT_APPROVED') < migrationRunner.indexOf('npx prisma migrate deploy'),
  );
});

test('production migration runs once and proves applied status before post dry-run', () => {
  assert.match(workflow, /MIGRATION_PRODUCTION_STARTED/);
  assert.match(workflow, /MIGRATION_PRODUCTION_SUCCEEDED/);
  assert.match(workflow, /MIGRATION_PRODUCTION_FAILED/);
  assert.match(workflow, new RegExp(`MIGRATION_STATUS_APPLIED: ${migrationName}`));
  assert.match(workflow, /npx prisma migrate deploy --schema prisma\/schema\.prisma/);
  assert.match(workflow, /npx prisma migrate status --schema prisma\/schema\.prisma/);
});

test('production workflow cannot deploy rebuild restart backfill or trigger other workflows', () => {
  assert.doesNotMatch(workflow, /docker compose .* up\b|docker compose .* build\b|docker compose .* restart\b/);
  assert.doesNotMatch(workflow, /deploy-vps\.yml|Tenant Nullability Dry Run|tenant-nullability-dry-run\.yml/);
  assert.doesNotMatch(workflow, /gh workflow run|workflow run|backfill/i);
  assert.doesNotMatch(workflow, /\bpsql\b|ALTER TABLE|UPDATE |DELETE |INSERT |TRUNCATE |DROP |CREATE /i);
});

test('production workflow suppresses env secrets URLs hostnames and raw diagnostics', () => {
  assert.doesNotMatch(workflow, /cat deploy\/v2\/\.env|cat .*\.env/);
  assert.doesNotMatch(workflow, /\bprintenv\b|\benv\b\s*(\||>|$)/);
  assert.doesNotMatch(workflow, /DATABASE_URL|POSTGRES_URL|NEXTAUTH_SECRET|JWT_SECRET|CLERK_SECRET_KEY/);
  assert.doesNotMatch(workflow, /https?:\/\//);
  assert.doesNotMatch(workflow, /app\.oasis|api\.oasis|oasis-care\.(co|care)/);
  assert.doesNotMatch(workflow, /cat "\$diagnostic_file"|cat "\$status_file"|cat "\$deploy_file"/);
  assert.doesNotMatch(workflow, /cat "\$remote_tmp\/transport\.(out|err)"/);
  assert.doesNotMatch(workflow, /cat "\$target_marker"|cat \/etc\/oasis\/production-deploy-target-class/);
});

test('production docker compose exec calls declare explicit stdin handling', () => {
  const execLinePattern = /docker compose .*exec -T api sh -lc '/g;
  const matches = [...workflow.matchAll(execLinePattern)];

  assert.equal(matches.length, 4);
  for (const match of matches) {
    const redirectEnd = workflow.indexOf('2> "$remote_tmp/transport.err"', match.index);
    assert.notEqual(redirectEnd, -1);
    const execBlock = workflow.slice(match.index, workflow.indexOf('\n', redirectEnd));
    assert.match(
      execBlock,
      /< \/dev\/null|< "\$remote_script_dir\/tenant-nullability-dry-run\.mjs"/,
      `docker compose exec call must explicitly handle stdin:\n${execBlock}`,
    );
  }
});
