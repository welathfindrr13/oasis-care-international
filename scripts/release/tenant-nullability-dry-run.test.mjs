import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatTenantNullabilityReport,
  parseTenantNullabilityArgs,
  proveTenantNotNullMigrationApplied,
  runTenantNullabilityDryRun,
  SENSITIVE_TENANT_TABLES,
  TENANT_NOT_NULL_MIGRATION,
  TENANT_NOT_NULL_TABLES,
  tenantMigrationAppliedSql,
  tenantNotNullSchemaSql,
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
  const queries = [];
  return {
    queries,
    $queryRawUnsafe: async (sql) => {
      queries.push(sql);
      const tableMatch = sql.match(/FROM "([^"]+)"/);
      const table = SENSITIVE_TENANT_TABLES.find((entry) => entry.table === tableMatch?.[1]);
      return [{ count: table ? countsByModel[table.model] ?? 0 : 0 }];
    },
  };
}

function createPrismaWithMigrationProof({
  appliedCount = 1,
  nullableTables = [],
  omittedTables = [],
} = {}) {
  const queries = [];
  const nullable = new Set(nullableTables);
  const omitted = new Set(omittedTables);

  return {
    queries,
    $queryRawUnsafe: async (sql, ...parameters) => {
      queries.push({ sql, parameters });
      if (sql.includes('WHERE organization_id IS NULL')) return [{ count: 0 }];
      if (sql.includes('FROM "_prisma_migrations"')) return [{ count: appliedCount }];
      if (sql.includes('FROM information_schema.columns')) {
        return TENANT_NOT_NULL_TABLES.filter((table) => !omitted.has(table.table)).map(
          (table) => ({
            table_name: table.table,
            is_nullable: nullable.has(table.table) ? 'YES' : 'NO',
          }),
        );
      }
      throw new Error('Unexpected proof query');
    },
  };
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

test('tenant migration proof arguments require an explicit migration name', () => {
  assert.deepEqual(
    parseTenantNullabilityArgs([
      '--fail-on-null',
      '--exclude',
      'AuditLog',
      '--prove-applied-migration',
      TENANT_NOT_NULL_MIGRATION,
    ]),
    {
      failOnNull: true,
      excludeModels: ['AuditLog'],
      proveAppliedMigration: TENANT_NOT_NULL_MIGRATION,
    },
  );
  assert.throws(
    () => parseTenantNullabilityArgs(['--prove-applied-migration']),
    /Missing value for --prove-applied-migration/,
  );
  assert.throws(
    () => parseTenantNullabilityArgs(['--prove-applied-migration=']),
    /Missing value for --prove-applied-migration/,
  );
});

test('tenant migration proof confirms the exact applied record and all eligible constraints', async () => {
  const prisma = createPrismaWithMigrationProof();
  const lines = [];
  const exitCode = await runTenantNullabilityDryRun({
    prisma,
    failOnNull: true,
    excludeModels: ['AuditLog'],
    proveAppliedMigration: TENANT_NOT_NULL_MIGRATION,
    log: (line) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(
    lines.join('\n'),
    new RegExp(`TARGET_MIGRATION_APPLIED_CONFIRMED: ${TENANT_NOT_NULL_MIGRATION}`),
  );
  assert.match(
    lines.join('\n'),
    new RegExp(`TENANT_NOT_NULL_SCHEMA_CONFIRMED: ${TENANT_NOT_NULL_TABLES.length}`),
  );
  const migrationQuery = prisma.queries.find(({ sql }) =>
    sql.includes('FROM "_prisma_migrations"'),
  );
  assert.deepEqual(migrationQuery.parameters, [TENANT_NOT_NULL_MIGRATION]);
  assert.equal(
    prisma.queries.filter(({ sql }) => sql.includes('FROM information_schema.columns')).length,
    1,
  );
});

test('tenant migration proof fails closed for missing history or nullable constraints', async () => {
  await assert.rejects(
    () =>
      proveTenantNotNullMigrationApplied(
        createPrismaWithMigrationProof({ appliedCount: 0 }),
        TENANT_NOT_NULL_MIGRATION,
      ),
    /Target tenant migration is not applied exactly once/,
  );
  await assert.rejects(
    () =>
      proveTenantNotNullMigrationApplied(
        createPrismaWithMigrationProof({ nullableTables: ['client'] }),
        TENANT_NOT_NULL_MIGRATION,
      ),
    /Tenant NOT NULL schema proof mismatch/,
  );
  await assert.rejects(
    () =>
      proveTenantNotNullMigrationApplied(
        createPrismaWithMigrationProof({ omittedTables: ['client'] }),
        TENANT_NOT_NULL_MIGRATION,
      ),
    /Tenant NOT NULL schema proof incomplete/,
  );
});

test('tenant migration metadata queries are static and read-only', () => {
  assert.match(tenantMigrationAppliedSql(), /^SELECT COUNT\(\*\)::int AS count FROM/);
  assert.match(tenantMigrationAppliedSql(), /migration_name = \$1/);
  assert.match(tenantNotNullSchemaSql(), /^SELECT table_name, is_nullable FROM information_schema\.columns/);
  assert.doesNotMatch(tenantNotNullSchemaSql(), /audit_log/);
  for (const sql of [tenantMigrationAppliedSql(), tenantNotNullSchemaSql()]) {
    assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP|CREATE|ALTER)\b/i);
  }
});

test('tenant nullability dry-run uses raw SQL counts from static table inventory', async () => {
  const prisma = createPrismaWithCounts({ Client: 2 });
  const lines = [];
  const exitCode = await runTenantNullabilityDryRun({
    prisma,
    excludeModels: ['AuditLog'],
    log: (line) => lines.push(line),
  });

  assert.equal(exitCode, 0);
  assert.match(lines.join('\n'), /Client \(client\): null organization_id rows = 2/);
  assert.equal(prisma.queries.length, SENSITIVE_TENANT_TABLES.length - 1);

  for (const sql of prisma.queries) {
    assert.match(sql, /^SELECT COUNT\(\*\)::int AS count FROM "[a-z_]+" WHERE organization_id IS NULL$/);
    assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP|CREATE|ALTER)\b/i);
  }
});

test('tenant nullability dry-run rejects non-inventory raw SQL table names', async () => {
  await assert.rejects(
    () =>
      runTenantNullabilityDryRun({
        prisma: createPrismaWithCounts(),
        tables: [{ model: 'Injected', table: 'client"; DELETE FROM client; --' }],
      }),
    /Table is not in tenant nullability inventory/,
  );
});

test('tenant nullability dry-run does not use Prisma nullable organization filters', () => {
  assert.doesNotMatch(scriptSource, /organization_id:\s*null/);
  assert.doesNotMatch(scriptSource, /organization_id:\s*\{\s*not:\s*null\s*\}/);
  assert.doesNotMatch(scriptSource, /\.count\(\{\s*where:/s);
});

test('tenant nullability raw SQL remains read-only', () => {
  assert.match(scriptSource, /SELECT COUNT\(\*\)::int AS count FROM/);
  assert.match(scriptSource, /WHERE organization_id IS NULL/);
  assert.doesNotMatch(scriptSource, /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|DROP|CREATE|ALTER)\b/i);
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
