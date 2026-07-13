#!/usr/bin/env node

export const SENSITIVE_TENANT_TABLES = Object.freeze([
  { model: 'Carer', table: 'carer', delegate: 'carer' },
  { model: 'Client', table: 'client', delegate: 'client' },
  { model: 'Visit', table: 'visit', delegate: 'visit' },
  { model: 'CarerShift', table: 'carer_shift', delegate: 'carerShift' },
  { model: 'MedicationAudit', table: 'medication_audit', delegate: 'medicationAudit' },
  { model: 'Assessment', table: 'assessment', delegate: 'assessment' },
  { model: 'CarePlan', table: 'care_plan', delegate: 'carePlan' },
  { model: 'EvidencePack', table: 'evidence_pack', delegate: 'evidencePack' },
  { model: 'CareLog', table: 'care_log', delegate: 'careLog' },
  { model: 'ConsentRecord', table: 'consent_record', delegate: 'consentRecord' },
  { model: 'AuditLog', table: 'audit_log', delegate: 'auditLog' },
  { model: 'ErasureQueue', table: 'erasure_queue', delegate: 'erasureQueue' },
]);

export const TENANT_NOT_NULL_MIGRATION =
  '20260707090000_tenant_organization_not_null';

export const TENANT_NOT_NULL_TABLES = Object.freeze(
  SENSITIVE_TENANT_TABLES.filter((table) => table.model !== 'AuditLog'),
);

export function formatTenantNullabilityReport(results, { excludedModels = [] } = {}) {
  const lines = ['Tenant nullability dry-run'];
  if (excludedModels.length > 0) {
    lines.push(`Excluded models: ${excludedModels.join(', ')}`);
  }
  for (const result of results) {
    lines.push(`${result.model} (${result.table}): null organization_id rows = ${result.count}`);
  }
  lines.push('No data changed.');
  return lines.join('\n');
}

export function parseTenantNullabilityArgs(argv) {
  const excludeModels = [];
  let proveAppliedMigration;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--exclude') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --exclude');
      }
      excludeModels.push(...parseModelList(value));
      index += 1;
      continue;
    }

    if (arg.startsWith('--exclude=')) {
      excludeModels.push(...parseModelList(arg.slice('--exclude='.length)));
      continue;
    }

    if (arg === '--prove-applied-migration') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --prove-applied-migration');
      }
      proveAppliedMigration = value;
      index += 1;
      continue;
    }

    if (arg.startsWith('--prove-applied-migration=')) {
      const value = arg.slice('--prove-applied-migration='.length);
      if (!value) {
        throw new Error('Missing value for --prove-applied-migration');
      }
      proveAppliedMigration = value;
    }
  }

  return {
    failOnNull: argv.includes('--fail-on-null'),
    excludeModels,
    proveAppliedMigration,
  };
}

function parseModelList(value) {
  return value
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

export function selectTenantNullabilityTables({ excludeModels = [] } = {}) {
  const models = new Set(SENSITIVE_TENANT_TABLES.map((table) => table.model));
  const unknownModels = [...new Set(excludeModels)].filter((model) => !models.has(model));
  if (unknownModels.length > 0) {
    throw new Error(`Unknown model in --exclude: ${unknownModels.join(', ')}`);
  }

  const excluded = new Set(excludeModels);
  return SENSITIVE_TENANT_TABLES.filter((table) => !excluded.has(table.model));
}

export function tenantNullabilityCountSql(table) {
  const isKnownTable = SENSITIVE_TENANT_TABLES.some(
    (entry) => entry.model === table.model && entry.table === table.table,
  );
  if (!isKnownTable) {
    throw new Error(`Table is not in tenant nullability inventory: ${table.model}`);
  }

  return `SELECT COUNT(*)::int AS count FROM "${table.table}" WHERE organization_id IS NULL`;
}

export async function collectTenantNullabilityCounts(prisma, { tables = SENSITIVE_TENANT_TABLES } = {}) {
  const results = [];

  for (const table of tables) {
    if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
      throw new Error('Prisma raw query client missing for tenant nullability dry-run');
    }

    // Safe because table names come only from SENSITIVE_TENANT_TABLES above.
    const rows = await prisma.$queryRawUnsafe(tenantNullabilityCountSql(table));
    const count = Number(rows?.[0]?.count ?? 0);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Invalid null tenant count for ${table.model}`);
    }

    results.push({
      model: table.model,
      table: table.table,
      count,
    });
  }

  return results;
}

export function tenantMigrationAppliedSql() {
  return `SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
}

export function tenantNotNullSchemaSql() {
  const tables = TENANT_NOT_NULL_TABLES.map((table) => `'${table.table}'`).join(', ');
  return `SELECT table_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND table_name IN (${tables}) ORDER BY table_name`;
}

export async function proveTenantNotNullMigrationApplied(prisma, migrationName) {
  if (migrationName !== TENANT_NOT_NULL_MIGRATION) {
    throw new Error('Unsupported tenant NOT NULL migration proof');
  }
  if (!prisma || typeof prisma.$queryRawUnsafe !== 'function') {
    throw new Error('Prisma raw query client missing for tenant migration proof');
  }

  const migrationRows = await prisma.$queryRawUnsafe(
    tenantMigrationAppliedSql(),
    migrationName,
  );
  const appliedCount = Number(migrationRows?.[0]?.count ?? 0);
  if (appliedCount !== 1) {
    throw new Error('Target tenant migration is not applied exactly once');
  }

  const columnRows = await prisma.$queryRawUnsafe(tenantNotNullSchemaSql());
  const expectedTables = new Set(TENANT_NOT_NULL_TABLES.map((table) => table.table));
  const confirmedTables = new Set();

  for (const row of columnRows ?? []) {
    const tableName = String(row?.table_name ?? '');
    const isNullable = String(row?.is_nullable ?? '');
    if (!expectedTables.has(tableName) || isNullable !== 'NO') {
      throw new Error('Tenant NOT NULL schema proof mismatch');
    }
    confirmedTables.add(tableName);
  }

  if (confirmedTables.size !== expectedTables.size) {
    throw new Error('Tenant NOT NULL schema proof incomplete');
  }

  return { migrationName, tableCount: confirmedTables.size };
}

export async function runTenantNullabilityDryRun({
  prisma,
  failOnNull = false,
  excludeModels = [],
  proveAppliedMigration,
  tables: selectedTables,
  log = console.log,
} = {}) {
  let client = prisma;
  let shouldDisconnect = false;
  const tables = selectedTables ?? selectTenantNullabilityTables({ excludeModels });

  if (!client) {
    const { PrismaClient } = await import('../../libs/db/src/generated/client/index.js');
    client = new PrismaClient();
    shouldDisconnect = true;
  }

  try {
    const results = await collectTenantNullabilityCounts(client, { tables });
    log(formatTenantNullabilityReport(results, { excludedModels: excludeModels }));

    const nullTenantTables = results.filter((result) => result.count > 0);
    if (failOnNull && nullTenantTables.length > 0) {
      return 1;
    }

    if (proveAppliedMigration) {
      const proof = await proveTenantNotNullMigrationApplied(
        client,
        proveAppliedMigration,
      );
      log(`TARGET_MIGRATION_APPLIED_CONFIRMED: ${proof.migrationName}`);
      log(`TENANT_NOT_NULL_SCHEMA_CONFIRMED: ${proof.tableCount}`);
    }
    return 0;
  } finally {
    if (shouldDisconnect && typeof client.$disconnect === 'function') {
      await client.$disconnect();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { failOnNull, excludeModels, proveAppliedMigration } =
      parseTenantNullabilityArgs(process.argv.slice(2));

    runTenantNullabilityDryRun({
      failOnNull,
      excludeModels,
      proveAppliedMigration,
    })
      .then((exitCode) => {
        process.exitCode = exitCode;
      })
      .catch((error) => {
        console.error(`Tenant nullability dry-run failed: ${error?.message || 'unknown error'}`);
        process.exitCode = 1;
      });
  } catch (error) {
    console.error(`Tenant nullability dry-run failed: ${error?.message || 'unknown error'}`);
    process.exitCode = 1;
  }
}
