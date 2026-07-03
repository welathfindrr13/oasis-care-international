import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatTenantNullabilityReport,
  runTenantNullabilityDryRun,
  SENSITIVE_TENANT_TABLES,
} from './tenant-nullability-dry-run.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const scriptSource = fs.readFileSync(
  new URL('./tenant-nullability-dry-run.mjs', import.meta.url),
  'utf8',
);
const dryRunDocs = fs.readFileSync(
  new URL('../../docs/tenant-nullability-phase1.md', import.meta.url),
  'utf8',
);
const rootPackageJson = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean);

function createPrismaWithCounts(countsByModel = {}) {
  return Object.fromEntries(
    SENSITIVE_TENANT_TABLES.map((table) => [
      table.delegate,
      {
        count: async () => countsByModel[table.model] ?? 0,
      },
    ]),
  );
}

test('tenant nullability dry-run inventory includes sensitive nullable tenant tables', () => {
  const models = SENSITIVE_TENANT_TABLES.map((table) => table.model);

  assert.deepEqual(models, [
    'Carer',
    'Client',
    'Visit',
    'CarerShift',
    'MedicationAudit',
    'Assessment',
    'CarePlan',
    'EvidencePack',
    'CareLog',
    'ConsentRecord',
    'AuditLog',
    'ErasureQueue',
  ]);
});

test('tenant nullability dry-run report emits counts without row data', () => {
  const report = formatTenantNullabilityReport([
    { model: 'Client', table: 'client', count: 0 },
    { model: 'Visit', table: 'visit', count: 2 },
  ]);

  assert.match(report, /^Tenant nullability dry-run/m);
  assert.match(report, /Client \(client\): null organization_id rows = 0/);
  assert.match(report, /Visit \(visit\): null organization_id rows = 2/);
  assert.match(report, /No data changed\./);
  assert.doesNotMatch(report, /client-1|visit-1|email|name|SELECT \*/i);
});

test('tenant nullability dry-run includes AuditLog by default', async () => {
  const lines = [];
  const exitCode = await runTenantNullabilityDryRun({
    prisma: createPrismaWithCounts({ AuditLog: 7 }),
    log: (line) => lines.push(line),
  });
  const report = lines.join('\n');

  assert.equal(exitCode, 0);
  assert.match(report, /AuditLog \(audit_log\): null organization_id rows = 7/);
  assert.doesNotMatch(report, /Excluded models:/);
});

test('tenant nullability dry-run excludes AuditLog from count output', async () => {
  const lines = [];
  const exitCode = await runTenantNullabilityDryRun({
    prisma: createPrismaWithCounts({ AuditLog: 7 }),
    excludeModels: ['AuditLog'],
    log: (line) => lines.push(line),
  });
  const report = lines.join('\n');

  assert.equal(exitCode, 0);
  assert.match(report, /Excluded models: AuditLog/);
  assert.doesNotMatch(report, /AuditLog \(audit_log\)/);
  assert.doesNotMatch(report, /client-1|visit-1|email|name|SELECT \*|secret|token/i);
});

test('tenant nullability fail-on-null can exclude AuditLog while eligible tables are zero', async () => {
  const lines = [];
  const exitCode = await runTenantNullabilityDryRun({
    prisma: createPrismaWithCounts({ AuditLog: 7 }),
    failOnNull: true,
    excludeModels: ['AuditLog'],
    log: (line) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(lines.join('\n'), /Excluded models: AuditLog/);
});

test('tenant nullability dry-run rejects unknown excluded models safely', async () => {
  await assert.rejects(
    () =>
      runTenantNullabilityDryRun({
        prisma: createPrismaWithCounts(),
        excludeModels: ['DefinitelyNotAModel'],
      }),
    /Unknown model in --exclude: DefinitelyNotAModel/,
  );
});

test('tenant nullability dry-run uses the generated workspace Prisma client', () => {
  assert.match(scriptSource, /libs\/db\/src\/generated\/client/);
  assert.doesNotMatch(scriptSource, /import\('@prisma\/client'\)/);
});

test('tenant nullability docs use a containerized staging path and generated local path', () => {
  assert.match(dryRunDocs, /Supported staging dry-run path/);
  assert.match(dryRunDocs, /docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml run --rm --no-deps --entrypoint node/);
  assert.match(dryRunDocs, /scripts\/release:\/app\/scripts\/release:ro/);
  assert.match(dryRunDocs, /--fail-on-null --exclude AuditLog/);
  assert.match(dryRunDocs, /Excluded models: AuditLog/);
  assert.match(dryRunDocs, /pnpm tenant:nullability:dry-run:local/);
  assert.doesNotMatch(dryRunDocs, /Use `scripts\/release\/tenant-nullability-dry-run\.mjs` for read-only counts:\n\n```bash\nnode scripts\/release\/tenant-nullability-dry-run\.mjs/);
});

test('local tenant nullability script generates Prisma before dry-run', () => {
  assert.equal(
    rootPackageJson.scripts['tenant:nullability:dry-run:local'],
    'pnpm --filter @oasis/db exec prisma generate && node scripts/release/tenant-nullability-dry-run.mjs',
  );
});

test('tenant nullability follow-up does not commit Debian query engine binary', () => {
  const trackedDebianEngines = trackedFiles.filter((file) =>
    file.endsWith('/libquery_engine-debian-openssl-3.0.x.so.node'),
  );

  assert.deepEqual(trackedDebianEngines, []);
});
