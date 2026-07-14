import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./ci.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);

test('CI executes Prisma migrations before the linked-carer browser journey', () => {
  assert.match(workflow, /run: pnpm --filter @oasis\/db exec prisma migrate deploy/);
  assert.match(workflow, /run: pnpm test:browser:linked-carer/);
});

test('CI composes the maintained accessibility gate into its browser journey', () => {
  assert.equal(
    packageJson.scripts['test:browser:accessibility'],
    'node --test tests/browser/fixtures/accessibility-api.test.mjs && playwright test --config playwright.accessibility.config.ts',
  );
  assert.match(
    packageJson.scripts['test:browser:linked-carer'],
    /^pnpm test:browser:accessibility && /,
  );

  const installIndex = workflow.indexOf(
    'run: pnpm exec playwright install --with-deps chromium',
  );
  const browserJourneyIndex = workflow.indexOf(
    'run: pnpm test:browser:linked-carer',
  );
  assert.notEqual(installIndex, -1);
  assert.notEqual(browserJourneyIndex, -1);
  assert.ok(
    browserJourneyIndex > installIndex,
    'the composed browser checks must run after Chromium is installed',
  );
});

test('Deployment V2 CI compose verification uses the generated env file', () => {
  assert.match(workflow, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});

test('Deployment V2 CI Caddy validation uses the generated env file', () => {
  assert.match(workflow, /docker run --rm --env-file "\$TEMP_ENV" .* caddy validate --config \/etc\/caddy\/Caddyfile/);
});

test('Deployment V2 CI synthetic env includes required Clerk redirect URLs', () => {
  assert.match(workflow, /NEXT_PUBLIC_CLERK_SIGN_UP_URL=https:\/\/care\.example\.org\/sign-up/);
  assert.match(workflow, /NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=https:\/\/care\.example\.org\/today/);
  assert.match(workflow, /NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=https:\/\/care\.example\.org\/today/);
});

test('Deployment V2 CI synthetic env includes the complete shift idempotency key ring', () => {
  assert.match(workflow, /SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID=shift-synthetic/);
  assert.match(
    workflow,
    /SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=/,
  );
  assert.match(workflow, /SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON=\[\]/);
});

test('Deployment V2 CI runs tenant nullability dry-run workflow static guard', () => {
  assert.match(workflow, /node --test \.github\/workflows\/tenant-nullability-dry-run\.test\.mjs/);
});

test('Deployment V2 CI runs staging migration rehearsal workflow static guard', () => {
  assert.match(
    workflow,
    /node --test \.github\/workflows\/staging-tenant-migration-rehearsal\.test\.mjs/,
  );
});

test('Deployment V2 CI runs production migration gate workflow static guard', () => {
  assert.match(
    workflow,
    /node --test \.github\/workflows\/production-tenant-migration-gate\.test\.mjs/,
  );
});

test('Deployment V2 CI runs production backup restore proof workflow guard', () => {
  assert.match(
    workflow,
    /node --test \.github\/workflows\/production-backup-restore-proof\.test\.mjs/,
  );
});
