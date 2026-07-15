import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./ci.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
const linkedCarerConfig = fs.readFileSync(
  new URL('../../playwright.linked-carer.config.ts', import.meta.url),
  'utf8',
);
const linkedCarerSeed = fs.readFileSync(
  new URL('../../scripts/test/seed-linked-carer-browser.mjs', import.meta.url),
  'utf8',
);
const linkedCarerJourney = fs.readFileSync(
  new URL(
    '../../tests/browser/linked-carer-assigned-work.spec.ts',
    import.meta.url,
  ),
  'utf8',
);

test('CI executes Prisma migrations before the linked-carer browser journey', () => {
  assert.match(workflow, /run: pnpm --filter @oasis\/db exec prisma migrate deploy/);
  assert.match(workflow, /run: pnpm test:browser:linked-carer/);
});

test('CI runs the Clerk tenant auth browser proof after migrations and Chromium install', () => {
  const migrationIndex = workflow.indexOf(
    'run: pnpm --filter @oasis/db exec prisma migrate deploy',
  );
  const installIndex = workflow.indexOf(
    'run: pnpm exec playwright install --with-deps chromium',
  );
  const clerkJourneyIndex = workflow.indexOf(
    'run: pnpm test:browser:clerk-tenant-auth',
  );
  assert.notEqual(migrationIndex, -1);
  assert.notEqual(installIndex, -1);
  assert.notEqual(clerkJourneyIndex, -1);
  assert.ok(clerkJourneyIndex > migrationIndex);
  assert.ok(clerkJourneyIndex > installIndex);
  assert.match(
    packageJson.scripts['test:browser:clerk-tenant-auth'],
    /^node --test scripts\/test\/assert-safe-test-database\.test\.mjs && /,
  );
  assert.match(
    workflow,
    /run: pnpm test:browser:clerk-tenant-auth\n\s+env:\n\s+DATABASE_URL: postgresql:\/\/test:test@localhost:5432\/oasis_test\n\s+OASIS_TEST_DATABASE_SEED_ACK: reset-test-data/,
  );
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

test('linked-carer browser fixtures use Clerk tenant binding with local test signing', () => {
  assert.match(linkedCarerConfig, /LOCAL_AUTH_ENABLED: "true"/);
  assert.match(linkedCarerConfig, /AUTH_IDENTITY_PROVIDER: "clerk"/);
  assert.doesNotMatch(linkedCarerSeed, /identity_provider: "cognito"/);
  assert.match(linkedCarerSeed, /identity_provider: "clerk"/);
  assert.match(
    linkedCarerSeed,
    /\.update\(`\$\{role\}:\$\{email\}:\$\{ORGANIZATION_ID\}`\)/,
  );
  assert.match(
    linkedCarerJourney,
    /organizationId: profile\.organizationId \?\? ORGANIZATION_ID/,
  );
});

test('Deployment V2 CI compose verification uses the generated env file', () => {
  assert.match(workflow, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});

test('Deployment V2 CI Caddy validation uses the generated env file', () => {
  assert.match(workflow, /docker run --rm --env-file "\$TEMP_ENV" .* caddy validate --config \/etc\/caddy\/Caddyfile/);
});

test('Deployment V2 CI synthetic env includes required Clerk redirect URLs', () => {
  assert.match(workflow, /NEXT_PUBLIC_CLERK_CSP_ORIGINS=https:\/\/synthetic-clerk\.oasis\.invalid/);
  assert.match(workflow, /NEXT_PUBLIC_CLERK_SIGN_UP_URL=https:\/\/care\.example\.org\/sign-up/);
  assert.match(workflow, /NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=https:\/\/care\.example\.org\/today/);
  assert.match(workflow, /NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=https:\/\/care\.example\.org\/today/);
});

test('CI production web builds configure the synthetic Clerk FAPI CSP origin', () => {
  const exports = workflow.match(
    /export NEXT_PUBLIC_CLERK_CSP_ORIGINS="https:\/\/synthetic-clerk\.oasis\.invalid"/g,
  ) ?? [];
  assert.equal(exports.length, 2);
  assert.match(
    workflow,
    /- name: Lint\n\s+run: pnpm turbo run lint\n\s+env:\n\s+NEXT_PUBLIC_CLERK_CSP_ORIGINS: https:\/\/synthetic-clerk\.oasis\.invalid/,
  );
});

test('Deployment V2 CI synthetic env includes the complete shift idempotency key ring', () => {
  assert.match(workflow, /SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID=shift-synthetic/);
  assert.match(
    workflow,
    /SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET=YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=/,
  );
  assert.match(workflow, /SHIFT_IDEMPOTENCY_HMAC_PREVIOUS_KEYS_JSON=\[\]/);
});

test('Deployment V2 CI synthetic env includes the visit completion proof key', () => {
  assert.match(workflow, /VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID=visit-synthetic/);
  assert.match(
    workflow,
    /VISIT_COMPLETION_PROOF_ACTIVE_SECRET=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc/,
  );
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
