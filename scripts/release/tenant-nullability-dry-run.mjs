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
    }
  }

  return {
    failOnNull: argv.includes('--fail-on-null'),
    excludeModels,
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

export async function collectTenantNullabilityCounts(prisma, { tables = SENSITIVE_TENANT_TABLES } = {}) {
  const results = [];

  for (const table of tables) {
    const delegate = prisma?.[table.delegate];
    if (!delegate || typeof delegate.count !== 'function') {
      throw new Error(`Prisma delegate missing for ${table.model}`);
    }

    const count = await delegate.count({
      where: {
        organization_id: null,
      },
    });

    results.push({
      model: table.model,
      table: table.table,
      count,
    });
  }

  return results;
}

export async function runTenantNullabilityDryRun({
  prisma,
  failOnNull = false,
  excludeModels = [],
  log = console.log,
} = {}) {
  let client = prisma;
  let shouldDisconnect = false;
  const tables = selectTenantNullabilityTables({ excludeModels });

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
    return 0;
  } finally {
    if (shouldDisconnect && typeof client.$disconnect === 'function') {
      await client.$disconnect();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { failOnNull, excludeModels } = parseTenantNullabilityArgs(process.argv.slice(2));

    runTenantNullabilityDryRun({ failOnNull, excludeModels })
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
