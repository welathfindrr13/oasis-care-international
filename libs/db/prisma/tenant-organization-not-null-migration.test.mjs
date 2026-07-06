import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = new URL(
  './migrations/20260707090000_tenant_organization_not_null/migration.sql',
  import.meta.url,
).pathname;
const schemaPath = new URL('./schema.prisma', import.meta.url).pathname;
const dryRunPath = new URL('../../../scripts/release/tenant-nullability-dry-run.mjs', import.meta.url)
  .pathname;

const eligibleTables = [
  ['Carer', 'carer'],
  ['Client', 'client'],
  ['Visit', 'visit'],
  ['CarerShift', 'carer_shift'],
  ['MedicationAudit', 'medication_audit'],
  ['Assessment', 'assessment'],
  ['CarePlan', 'care_plan'],
  ['EvidencePack', 'evidence_pack'],
  ['CareLog', 'care_log'],
  ['ConsentRecord', 'consent_record'],
  ['ErasureQueue', 'erasure_queue'],
];

const modelsWithOrganizationRelation = [
  'Carer',
  'Client',
  'Visit',
  'CarerShift',
  'MedicationAudit',
  'CareLog',
  'ConsentRecord',
  'ErasureQueue',
];

function modelBlock(schema, model) {
  const match = schema.match(new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `Missing model block for ${model}`);
  return match[0];
}

test('tenant organization NOT NULL migration covers only eligible tables', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  for (const [, table] of eligibleTables) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE "${table}"\\s+ALTER COLUMN "organization_id" SET NOT NULL;`),
      `Missing NOT NULL alteration for ${table}`,
    );
  }

  const alteredTables = [...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(alteredTables.sort(), eligibleTables.map(([, table]) => table).sort());
  assert.doesNotMatch(sql, /"audit_log"/);
  assert.doesNotMatch(sql, /\b(?:UPDATE|INSERT|DELETE|TRUNCATE|DROP|CREATE)\b/i);
});

test('tenant organization NOT NULL schema excludes AuditLog exception', () => {
  const schema = readFileSync(schemaPath, 'utf8');

  for (const [model] of eligibleTables) {
    assert.match(modelBlock(schema, model), /\n\s+organization_id\s+String(?:\s|$)/);
    assert.doesNotMatch(modelBlock(schema, model), /\n\s+organization_id\s+String\?/);
  }

  for (const model of modelsWithOrganizationRelation) {
    assert.match(modelBlock(schema, model), /\n\s+organization\s+Organization\s+@relation/);
    assert.doesNotMatch(modelBlock(schema, model), /\n\s+organization\s+Organization\?/);
  }

  assert.match(modelBlock(schema, 'AuditLog'), /\n\s+organization_id\s+String\?/);
  assert.match(modelBlock(schema, 'AuditLog'), /\n\s+organization\s+Organization\?/);
});

test('tenant dry-run inventory remains aligned with NOT NULL migration scope', () => {
  const dryRun = readFileSync(dryRunPath, 'utf8');

  for (const [model, table] of eligibleTables) {
    assert.match(dryRun, new RegExp(`\\{ model: '${model}', table: '${table}'`));
  }

  assert.match(dryRun, /\{ model: 'AuditLog', table: 'audit_log'/);
  assert.match(dryRun, /--exclude/);
});
