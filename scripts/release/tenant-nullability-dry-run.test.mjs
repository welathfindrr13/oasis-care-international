import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatTenantNullabilityReport,
  SENSITIVE_TENANT_TABLES,
} from './tenant-nullability-dry-run.mjs';

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
