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

export function formatTenantNullabilityReport(results) {
  const lines = ['Tenant nullability dry-run'];
  for (const result of results) {
    lines.push(`${result.model} (${result.table}): null organization_id rows = ${result.count}`);
  }
  lines.push('No data changed.');
  return lines.join('\n');
}

export async function collectTenantNullabilityCounts(prisma) {
  const results = [];

  for (const table of SENSITIVE_TENANT_TABLES) {
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

export async function runTenantNullabilityDryRun({ prisma, failOnNull = false, log = console.log } = {}) {
  let client = prisma;
  let shouldDisconnect = false;

  if (!client) {
    const { PrismaClient } = await import('../../libs/db/src/generated/client/index.js');
    client = new PrismaClient();
    shouldDisconnect = true;
  }

  try {
    const results = await collectTenantNullabilityCounts(client);
    log(formatTenantNullabilityReport(results));

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
  const failOnNull = process.argv.includes('--fail-on-null');

  runTenantNullabilityDryRun({ failOnNull })
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`Tenant nullability dry-run failed: ${error?.message || 'unknown error'}`);
      process.exitCode = 1;
    });
}
