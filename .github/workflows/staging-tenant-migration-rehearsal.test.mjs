import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(
  new URL('./staging-tenant-migration-rehearsal.yml', import.meta.url),
  'utf8',
);
const apiEntrypoint = fs.readFileSync(
  new URL('../../apps/api/docker-entrypoint.sh', import.meta.url),
  'utf8',
);

const migrationName = '20260707090000_tenant_organization_not_null';
const migrationPath =
  'libs/db/prisma/migrations/20260707090000_tenant_organization_not_null/migration.sql';
const expectedSha = 'bcf0bf56bf40a8c60533bf345f5c20e7b0ad5bc3';

function workflowSlice(start, end) {
  const startIndex = workflow.indexOf(start);
  const endIndex = workflow.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return workflow.slice(startIndex, endIndex);
}

test('staging tenant migration rehearsal workflow is manual only', () => {
  assert.match(workflow, /^on:\n\s+workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.doesNotMatch(workflow, /\bschedule:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:[\s\S]*inputs:/);
});

test('staging tenant migration rehearsal serializes with Deploy VPS', () => {
  assert.match(workflow, /concurrency:\s*\n\s*group: staging-vps-mutation\s*\n\s*cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /group: staging-tenant-migration-rehearsal/);
});

test('staging target proof fails closed before staging repo access or migration work', () => {
  const markerIndex = workflow.indexOf('/etc/oasis/deploy-target-class');
  const stagingLabelIndex = workflow.indexOf('DEPLOY_TARGET_STAGING');
  const unknownLabelIndex = workflow.indexOf('DEPLOY_TARGET_UNKNOWN');
  const notStagingLabelIndex = workflow.indexOf('DEPLOY_TARGET_NOT_STAGING');
  const gateCallIndex = workflow.lastIndexOf('\n          run_remote_gate');
  const preDryRunCallIndex = workflow.lastIndexOf('\n          run_tenant_dry_run pre');
  const statusProofCallIndex = workflow.lastIndexOf('\n          prove_pending_migration_set');
  const deployCallIndex = workflow.lastIndexOf('\n          run_single_migration');

  assert.notEqual(markerIndex, -1);
  assert.notEqual(stagingLabelIndex, -1);
  assert.notEqual(unknownLabelIndex, -1);
  assert.notEqual(notStagingLabelIndex, -1);
  assert.notEqual(gateCallIndex, -1);
  assert.notEqual(preDryRunCallIndex, -1);
  assert.notEqual(statusProofCallIndex, -1);
  assert.notEqual(deployCallIndex, -1);
  assert(gateCallIndex < preDryRunCallIndex, 'target proof must happen before dry-run');
  assert(gateCallIndex < statusProofCallIndex, 'target proof must happen before migration status');
  assert(gateCallIndex < deployCallIndex, 'target proof must happen before migration deploy');
  assert.match(workflow, /if \[ "\$target_class" = "staging" \]; then/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_STAGING\\n'/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_UNKNOWN\\n' >&2/);
  assert.match(workflow, /printf 'DEPLOY_TARGET_NOT_STAGING\\n' >&2/);
  assert.match(workflow, /exit 1/);
  assert.doesNotMatch(workflow, /cat \/etc\/oasis\/deploy-target-class/);
  assert.doesNotMatch(workflow, /printf .*target_class|echo .*target_class/);
});

test('staging code and migration file are proven with safe labels only', () => {
  assert.match(workflow, new RegExp(`EXPECTED_STAGING_SHA: ${expectedSha}`));
  assert.match(workflow, /current_sha="\$\(git rev-parse HEAD\)"/);
  assert.match(workflow, /STAGING_CODE_SHA_OK/);
  assert.match(workflow, /STAGING_CODE_SHA_MISMATCH/);
  assert.match(workflow, new RegExp(`test -f ${migrationPath.replaceAll('/', '\\/')}`));
  assert.match(workflow, /MIGRATION_FILE_PRESENT/);
  assert.match(workflow, /MIGRATION_FILE_MISSING/);
  assert.doesNotMatch(workflow, /printf .*current_sha|echo .*current_sha/);
});

test('pre-migration tenant dry-run is required before pending migration proof and deploy', () => {
  const preDryRunIndex = workflow.lastIndexOf('\n          run_tenant_dry_run pre');
  const pendingProofIndex = workflow.lastIndexOf('\n          prove_pending_migration_set');
  const deployIndex = workflow.lastIndexOf('\n          run_single_migration');

  assert.notEqual(preDryRunIndex, -1);
  assert.notEqual(pendingProofIndex, -1);
  assert.notEqual(deployIndex, -1);
  assert(preDryRunIndex < pendingProofIndex, 'pre dry-run must happen before pending proof');
  assert(pendingProofIndex < deployIndex, 'pending proof must happen before migration deploy');
  assert.match(workflow, /PASS: tenant nullability eligible-table gate passed\./);
  assert.match(workflow, /TENANT_NULLABILITY_DRY_RUN_REPORT_START/);
  assert.match(workflow, /TENANT_NULLABILITY_DRY_RUN_REPORT_END/);
  assert.match(workflow, /--fail-on-null --exclude AuditLog/);
  assert.match(workflow, /Tenant nullability dry-run failed with unsafe output suppressed\./);
});

test('pending migration proof gates deploy on exactly the approved migration', () => {
  const pendingProofIndex = workflow.lastIndexOf('\n          prove_pending_migration_set');
  const exactPendingIndex = workflow.indexOf('PENDING_MIGRATION_SET_EXACT');
  const deployIndex = workflow.lastIndexOf('\n          run_single_migration');

  assert.notEqual(pendingProofIndex, -1);
  assert.notEqual(exactPendingIndex, -1);
  assert.notEqual(deployIndex, -1);
  assert(pendingProofIndex < deployIndex, 'pending proof must run before prisma migrate deploy');
  assert(exactPendingIndex < deployIndex, 'exact pending class must be established before deploy');
  assert.match(workflow, new RegExp(migrationName));
  assert.match(workflow, /PENDING_MIGRATION_SET_ZERO/);
  assert.match(workflow, /PENDING_MIGRATION_SET_MULTIPLE/);
  assert.match(workflow, /PENDING_MIGRATION_SET_UNKNOWN/);
  assert.match(workflow, /PENDING_MIGRATION_SET_UNSAFE/);
  assert.match(workflow, /\[ "\$pending_count" -eq 1 \]/);
  assert.match(workflow, /\[ "\$pending_name" = "\$MIGRATION_NAME" \]/);
});

test('pending migration proof parses Prisma singular pending heading', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );
  const pendingHeadingPattern = /following migration.*not yet been applied/i;

  assert.match(pendingProof, /following migration\.\*not yet been applied/);
  assert.match(pendingProof, /sed -n .*\/I/);
  assert.doesNotMatch(pendingProof, /Following migrations\.\*not yet been applied/);
  assert.match(pendingProof, /grep -Eo "\^\[\[:space:\]\]\*\[0-9\]\{14\}_\[A-Za-z0-9_\]\+"/);
  assert.match('Following migration 20260707090000_tenant_organization_not_null have not yet been applied:', pendingHeadingPattern);
  assert.match('Following migrations have not yet been applied:', pendingHeadingPattern);
  assert.match('FOLLOWING MIGRATIONS HAVE NOT YET BEEN APPLIED:', pendingHeadingPattern);
});

test('pending migration proof exposes safe diagnostic classes for status setup failures', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );

  assert.match(pendingProof, /PRISMA_WORKDIR_OK/);
  assert.match(pendingProof, /PRISMA_WORKDIR_INVALID/);
  assert.match(pendingProof, /PRISMA_CLI_AVAILABLE/);
  assert.match(pendingProof, /PRISMA_CLI_UNAVAILABLE/);
  assert.match(pendingProof, /PENDING_MIGRATION_COMMAND_UNAVAILABLE/);
  assert.match(pendingProof, /PENDING_MIGRATION_NPX_UNAVAILABLE/);
  assert.match(pendingProof, /PENDING_MIGRATION_PRISMA_UNAVAILABLE/);
  assert.match(pendingProof, /PENDING_MIGRATION_WORKDIR_INVALID/);
  assert.match(pendingProof, /PENDING_MIGRATION_SCHEMA_MISSING/);
  assert.match(pendingProof, /PENDING_MIGRATION_DIR_MISSING/);
  assert.match(pendingProof, /PENDING_MIGRATION_FILE_NOT_VISIBLE/);
});

test('pending migration proof classifies empty nonzero unparseable unsafe and diverged status output', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );

  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_EMPTY/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_NONZERO_NO_PARSE/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_UNPARSEABLE/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_UNSAFE/);
  assert.match(pendingProof, /PENDING_MIGRATION_HISTORY_DIVERGED/);
  assert.match(pendingProof, /\[ "\$status" -eq 127 \][\s\S]*?PENDING_MIGRATION_PRISMA_UNAVAILABLE/);
  assert.match(pendingProof, /\[ "\$parsed_pending_count" -eq 0 \]/);
  assert.match(pendingProof, /\[ "\$status" -ne 0 \]/);
  assert.doesNotMatch(pendingProof, /cat "\$status_file"|cat "\$remote_tmp\/pending\.out"|cat "\$diagnostic_file"/);
});

test('pending proof and deploy use the API entrypoint Prisma working directory', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );
  const migrationRunner = workflowSlice(
    'run_single_migration() {',
    '\n          prove_migration_applied() {',
  );
  const appliedProof = workflowSlice(
    'prove_migration_applied() {',
    '\n          run_remote_gate',
  );

  assert.match(apiEntrypoint, /cd \/app\/libs\/db\s+npx prisma migrate deploy/);
  assert.match(pendingProof, /cd \/app\/libs\/db/);
  assert.match(migrationRunner, /cd \/app\/libs\/db/);
  assert.match(appliedProof, /cd \/app\/libs\/db/);
  assert.match(pendingProof, /npx prisma migrate status --schema prisma\/schema\.prisma/);
  assert.match(migrationRunner, /npx prisma migrate deploy --schema prisma\/schema\.prisma/);
  assert.match(appliedProof, /npx prisma migrate status --schema prisma\/schema\.prisma/);
  assert.doesNotMatch(pendingProof, /cd \/app\s+npx prisma migrate status/);
  assert.doesNotMatch(migrationRunner, /cd \/app\s+npx prisma migrate deploy/);
  assert.doesNotMatch(appliedProof, /cd \/app\s+npx prisma migrate status/);
});

test('pending migration proof cannot continue after unknown or malformed output', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );

  assert.match(pendingProof, /PENDING_MIGRATION_SET_ZERO[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_SET_MULTIPLE[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_SET_UNKNOWN[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_SET_UNSAFE[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_EMPTY[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_NONZERO_NO_PARSE[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_STATUS_UNPARSEABLE[\s\S]*?return 1/);
  assert.match(pendingProof, /PENDING_MIGRATION_FILE_NOT_VISIBLE[\s\S]*?return 1/);
  assert.doesNotMatch(pendingProof, /printf 'PENDING_MIGRATION_SET_UNKNOWN\\n' >&2\s*\n\s*return "\$status"/);
});

test('only exact pending proof can approve migration execution', () => {
  const pendingProof = workflowSlice(
    'prove_pending_migration_set() {',
    '\n          run_single_migration() {',
  );
  const exactPendingIndex = pendingProof.indexOf(
    'PENDING_MIGRATION_SET_EXACT: 20260707090000_tenant_organization_not_null',
  );
  const approvalIndex = pendingProof.indexOf(`MIGRATION_GATE_APPROVED="${migrationName}"`);

  assert.notEqual(exactPendingIndex, -1);
  assert.notEqual(approvalIndex, -1);
  assert(exactPendingIndex < approvalIndex, 'exact pending proof must happen before approval token');
  assert.match(pendingProof, new RegExp(`MIGRATION_GATE_APPROVED="${migrationName}"[\\s\\S]*?return 0`));
});

test('migration execution refuses to run without exact approval token', () => {
  const migrationRunner = workflowSlice(
    'run_single_migration() {',
    '\n          prove_migration_applied() {',
  );
  const gateIndex = migrationRunner.indexOf('MIGRATION_GATE_NOT_APPROVED');
  const startedIndex = migrationRunner.indexOf('MIGRATION_REHEARSAL_STARTED');
  const migrateIndex = migrationRunner.indexOf('npx prisma migrate deploy');

  assert.notEqual(gateIndex, -1);
  assert.notEqual(startedIndex, -1);
  assert.notEqual(migrateIndex, -1);
  assert(gateIndex < startedIndex, 'approval gate must run before rehearsal start marker');
  assert(gateIndex < migrateIndex, 'approval gate must run before prisma migrate deploy');
  assert.match(migrationRunner, new RegExp(`\\[ "\\$\\{MIGRATION_GATE_APPROVED:-\\}" != "${migrationName}" \\]`));
  assert.match(migrationRunner, /printf 'MIGRATION_GATE_NOT_APPROVED\\n' >&2[\s\S]*?return 1/);
});

test('migration command unavailable is classified without raw deploy logs', () => {
  const migrationRunner = workflowSlice(
    'run_single_migration() {',
    '\n          prove_migration_applied() {',
  );

  assert.match(migrationRunner, /\[ "\$status" -eq 127 \]/);
  assert.match(migrationRunner, /printf 'MIGRATION_REHEARSAL_COMMAND_UNAVAILABLE\\n' >&2/);
  assert.doesNotMatch(migrationRunner, /cat "\$result_file"|cat "\$diagnostic_file"|cat "\$deploy_file"/);
});

test('migration deploy is normal Prisma deploy only and captures safe status', () => {
  assert.match(workflow, /npx prisma migrate deploy/);
  assert.match(workflow, /MIGRATION_REHEARSAL_STARTED/);
  assert.match(workflow, /MIGRATION_REHEARSAL_SUCCEEDED/);
  assert.match(workflow, /MIGRATION_REHEARSAL_FAILED/);
  assert.match(workflow, /MIGRATION_STATUS_APPLIED/);
  assert.doesNotMatch(workflow, /\bpsql\b|ALTER TABLE|UPDATE |DELETE |INSERT |TRUNCATE |DROP |CREATE |backfill/i);
  assert.doesNotMatch(workflow, /docker compose .* up\b|docker compose .* build\b|docker compose .* restart\b/);
  assert.doesNotMatch(workflow, /deploy-vps\.yml|gh workflow run|workflow run Deploy VPS/i);
});

test('post-migration tenant dry-run happens only after successful migration status', () => {
  const deploySuccessIndex = workflow.indexOf('MIGRATION_REHEARSAL_SUCCEEDED');
  const appliedIndex = workflow.indexOf('MIGRATION_STATUS_APPLIED');
  const postDryRunIndex = workflow.indexOf('run_tenant_dry_run post');

  assert.notEqual(deploySuccessIndex, -1);
  assert.notEqual(appliedIndex, -1);
  assert.notEqual(postDryRunIndex, -1);
  assert(deploySuccessIndex < appliedIndex);
  assert(appliedIndex < postDryRunIndex);
});

test('workflow suppresses env, secrets, URLs, hostnames, and raw diagnostic dumps', () => {
  assert.doesNotMatch(workflow, /cat deploy\/v2\/\.env|cat .*\.env/);
  assert.doesNotMatch(workflow, /\bprintenv\b|\benv\b\s*(\||>|$)/);
  assert.doesNotMatch(workflow, /DATABASE_URL|POSTGRES_URL|NEXTAUTH_SECRET|JWT_SECRET|CLERK_SECRET_KEY/);
  assert.doesNotMatch(workflow, /https?:\/\//);
  assert.doesNotMatch(workflow, /app\.oasis|api\.oasis|oasis-care\.(co|care)/);
  assert.doesNotMatch(workflow, /cat "\$diagnostic_file"|cat "\$status_file"|cat "\$deploy_file"/);
  assert.doesNotMatch(workflow, /cat "\$remote_tmp\/transport\.(out|err)"/);
  assert.match(workflow, /grep -Eiq/);
});
