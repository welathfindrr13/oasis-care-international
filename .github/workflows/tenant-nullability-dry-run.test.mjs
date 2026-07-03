import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./tenant-nullability-dry-run.yml', import.meta.url), 'utf8');

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
  assert.match(workflow, /docker compose --env-file deploy\/v2\/\.env -f deploy\/v2\/docker-compose\.yml run --rm --no-deps --entrypoint node/);
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
  assert.match(workflow, /PASS: tenant nullability eligible-table gate passed\./);
  assert.match(workflow, /FAIL: tenant nullability eligible-table gate failed\./);
  assert.match(workflow, /unsafe tenant nullability dry-run output/i);
  assert.match(workflow, /grep -E/);
});
