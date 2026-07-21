import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const compose = fs.readFileSync(new URL('./docker-compose.yml', import.meta.url), 'utf8');
const legacyApiProductionEnv = fs.readFileSync(
  new URL('../../apps/api/.env.production.example', import.meta.url),
  'utf8',
);
const webDockerfile = fs.readFileSync(new URL('../../apps/web/Dockerfile', import.meta.url), 'utf8');
const apiDockerfile = fs.readFileSync(new URL('../../apps/api/Dockerfile', import.meta.url), 'utf8');
const apiProductionImageWorkflow = fs.readFileSync(
  new URL('../../.github/workflows/api-production-image-runtime.yml', import.meta.url),
  'utf8',
);
const apiPackage = JSON.parse(
  fs.readFileSync(new URL('../../apps/api/package.json', import.meta.url), 'utf8'),
);
const verifyLocalScript = fs.readFileSync(new URL('./scripts/verify-local.sh', import.meta.url), 'utf8');
const stagingDockerDeployScript = fs.readFileSync(
  new URL('../../infrastructure/scripts/docker-deploy.sh', import.meta.url),
  'utf8',
);
const deploymentReadme = fs.readFileSync(
  new URL('../../docs/deployment-v2/README.md', import.meta.url),
  'utf8',
);
const deployDir = path.dirname(fileURLToPath(import.meta.url));

function serviceBlock(name) {
  const start = compose.search(new RegExp(`^  ${name}:`, 'm'));
  assert.notEqual(start, -1, `${name} service should exist`);

  const next = compose.slice(start + 1).search(/^  [a-z][a-z0-9_-]*:/m);
  return next === -1 ? compose.slice(start) : compose.slice(start, start + 1 + next);
}

test('Caddy receives public domain environment used by the Caddyfile', () => {
  const caddyBlock = serviceBlock('caddy');

  assert.match(caddyBlock, /environment:/);
  assert.match(caddyBlock, /APP_DOMAIN:\s*\$\{APP_DOMAIN/);
  assert.match(caddyBlock, /ACME_EMAIL:\s*\$\{ACME_EMAIL/);
});

test('web service receives Clerk runtime environment for protected routes', () => {
  const webBlock = serviceBlock('web');

  assert.match(webBlock, /CLERK_SECRET_KEY:\s*\$\{CLERK_SECRET_KEY:\?/);
  assert.doesNotMatch(webBlock, /CLERK_SECRET_KEY:[^\n]*sk_test_synthetic_clerk_secret/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:\s*\$\{NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_CSP_ORIGINS:\s*\$\{NEXT_PUBLIC_CLERK_CSP_ORIGINS/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_SIGN_IN_URL:\s*\$\{NEXT_PUBLIC_CLERK_SIGN_IN_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_SIGN_UP_URL:\s*\$\{NEXT_PUBLIC_CLERK_SIGN_UP_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:\s*\$\{NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:\s*\$\{NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL/);
});

test('web build receives every Clerk public value used by Next.js config', () => {
  const webBlock = serviceBlock('web');

  for (const name of [
    'NEXT_PUBLIC_CLERK_CSP_ORIGINS',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  ]) {
    assert.match(webBlock, new RegExp(`args:[\\s\\S]*${name}:\\s*\\$\\{${name}:\\?`), `${name} should be a build arg`);
  }
});

test('web Dockerfile promotes every Clerk public build arg into build env', () => {
  for (const name of [
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
  ]) {
    assert.match(webDockerfile, new RegExp(`ARG ${name}=`));
    assert.match(webDockerfile, new RegExp(`ENV ${name}=\\$${name}`));
  }

  assert.match(webDockerfile, /ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\n/);
  assert.match(webDockerfile, /ARG NEXT_PUBLIC_CLERK_CSP_ORIGINS\n/);
  assert.equal(
    (webDockerfile.match(/ENV NEXT_PUBLIC_CLERK_CSP_ORIGINS=\$NEXT_PUBLIC_CLERK_CSP_ORIGINS/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(webDockerfile, /ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=/);
  assert.doesNotMatch(webDockerfile, /test -n "\$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"/);
  assert.match(
    verifyLocalScript,
    /docker build --build-arg NEXT_PUBLIC_CLERK_CSP_ORIGINS=https:\/\/care\.example\.org -f apps\/web\/Dockerfile -t oasis-web:v2 \./,
  );
  assert.match(
    verifyLocalScript,
    /NEXT_PUBLIC_CLERK_CSP_ORIGINS=https:\/\/care\.example\.org pnpm --filter @oasis\/web build/,
  );
});

test('maintained web Docker build entrypoints require the Clerk CSP origin', () => {
  assert.match(
    stagingDockerDeployScript,
    /docker build -t "\$\{ACCOUNT_ID\}\.dkr\.ecr\.\$\{AWS_REGION\}\.amazonaws\.com\/\$\{WEB_REPO\}:\$\{TAG\}" \\\n  --build-arg "NEXT_PUBLIC_CLERK_CSP_ORIGINS=\$\{NEXT_PUBLIC_CLERK_CSP_ORIGINS:\?NEXT_PUBLIC_CLERK_CSP_ORIGINS is required\}" \\\n  -f apps\/web\/Dockerfile \./,
  );
  assert.match(
    deploymentReadme,
    /docker build --build-arg "NEXT_PUBLIC_CLERK_CSP_ORIGINS=\$\{NEXT_PUBLIC_CLERK_CSP_ORIGINS:\?NEXT_PUBLIC_CLERK_CSP_ORIGINS is required\}" -f apps\/web\/Dockerfile -t oasis-web:v2 \./,
  );
});

test('web and api services expose only safe live revision metadata to health endpoints', () => {
  for (const service of ['web', 'api']) {
    const block = serviceBlock(service);

    assert.match(block, /APP_VERSION:\s*\$\{APP_VERSION:-unknown\}/);
    assert.match(block, /APP_COMMIT_SHA:\s*\$\{APP_COMMIT_SHA:-unknown\}/);
  }

  assert.match(webDockerfile, /ARG APP_VERSION=unknown/);
  assert.match(webDockerfile, /ARG APP_COMMIT_SHA=unknown/);
  assert.match(webDockerfile, /ENV APP_VERSION=\$APP_VERSION/);
  assert.match(webDockerfile, /ENV APP_COMMIT_SHA=\$APP_COMMIT_SHA/);
  assert.match(apiDockerfile, /ARG APP_VERSION=unknown/);
  assert.match(apiDockerfile, /ARG APP_COMMIT_SHA=unknown/);
  assert.match(apiDockerfile, /ENV APP_VERSION=\$APP_VERSION/);
  assert.match(apiDockerfile, /ENV APP_COMMIT_SHA=\$APP_COMMIT_SHA/);
  assert.doesNotMatch(compose, /APP_COMMIT_SHA:\s*\$\{DATABASE_URL|APP_VERSION:\s*\$\{DATABASE_URL/);
});

test('api production image packages every compiled Oasis workspace dependency', () => {
  assert.equal(apiPackage.dependencies['@oasis/auth'], 'workspace:*');
  assert.equal(apiPackage.dependencies['@oasis/db'], 'workspace:*');
  assert.equal(apiPackage.dependencies['@oasis/time'], 'workspace:*');
  assert.match(apiDockerfile, /COPY libs\/time\/package\.json \.\/libs\/time\//);
  assert.match(apiDockerfile, /RUN cd libs\/time && pnpm build/);
  assert.match(apiDockerfile, /sed -i[^\n]*libs\/time\/package\.json/);
  assert.match(apiDockerfile, /ln -s \/app\/libs\/time node_modules\/@oasis\/time/);
  assert.match(apiDockerfile, /COPY --from=build \/app\/libs\/time\/dist \.\/libs\/time\/dist/);
  assert.match(
    apiDockerfile,
    /RUN node -e "require\('@oasis\/auth'\); require\('@oasis\/db'\); require\('@oasis\/time'\)"/,
  );
});

test('api production image verification runs when the Docker build context changes', () => {
  assert.match(
    apiProductionImageWorkflow,
    /paths:\n(?:\s+- .+\n)*\s+- '\.dockerignore'/,
  );
});

test('web production image packages the compiled time workspace dependency', () => {
  assert.match(webDockerfile, /COPY libs\/time\/package\.json \.\/libs\/time\//);
  assert.match(webDockerfile, /RUN cd libs\/time && pnpm build/);
  assert.match(webDockerfile, /COPY --from=build \/app\/libs\/time\/package\.json \.\/libs\/time\/package\.json/);
  assert.match(webDockerfile, /COPY --from=build \/app\/libs\/time\/dist \.\/libs\/time\/dist/);
  assert.match(webDockerfile, /sed -i[^\n]*libs\/time\/package\.json/);
  assert.match(webDockerfile, /cd apps\/web && node -e "require\('@oasis\/time'\)"/);
});

test('api service does not inject a default Clerk audience', () => {
  const apiBlock = serviceBlock('api');

  assert.match(apiBlock, /CLERK_AUDIENCE:\s*\$\{CLERK_AUDIENCE:-\}/);
  assert.match(apiBlock, /NEXT_PUBLIC_SITE_URL:\s*\$\{NEXT_PUBLIC_SITE_URL:\?/);
  assert.doesNotMatch(apiBlock, /CLERK_AUDIENCE:[^\n]*oasis-api/);
});

test('api service hard-pins medication and eMAR off for the current launch', () => {
  const apiBlock = serviceBlock('api');

  assert.match(apiBlock, /MEDICATION_EMAR_ENABLED:\s*"false"/);
  assert.doesNotMatch(apiBlock, /MEDICATION_EMAR_ENABLED:\s*\$\{/);
});

test('platform operator allowlist is server-only and required by the api', () => {
  const apiBlock = serviceBlock('api');
  const webBlock = serviceBlock('web');

  assert.match(apiBlock, /PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID:\s*\$\{PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID:\?/);
  assert.match(apiBlock, /PLATFORM_OPERATOR_CLERK_SUBJECTS:\s*\$\{PLATFORM_OPERATOR_CLERK_SUBJECTS:\?/);
  assert.doesNotMatch(webBlock, /PLATFORM_OPERATOR_CLERK_/);
  assert.doesNotMatch(compose, /NEXT_PUBLIC_PLATFORM_OPERATOR/);
});

test('production deployment config fails fast for required env instead of using placeholders', () => {
  assert.doesNotMatch(compose, /\$\{[A-Z0-9_]+:-[^}]*?(replace-me|example\.com|clerk\.example\.com|app\.example\.com|localhost)/);

  for (const name of [
    'APP_DOMAIN',
    'ACME_EMAIL',
    'NEXTAUTH_SECRET',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_CLERK_CSP_ORIGINS',
    'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
    'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
    'CLERK_ISSUER',
    'CLERK_JWKS_URL',
    'CLERK_AUTHORIZED_PARTIES',
    'PLATFORM_OPERATOR_CLERK_ORGANIZATION_ID',
    'PLATFORM_OPERATOR_CLERK_SUBJECTS',
    'POSTGRES_PASSWORD',
    'JWT_SECRET',
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_KEY_ID',
    'SHIFT_IDEMPOTENCY_HMAC_CURRENT_SECRET',
    'VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID',
    'VISIT_COMPLETION_PROOF_ACTIVE_SECRET',
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `${name} should use required interpolation`);
  }
});

test('legacy API production env is a superseded marker, not a second deployment template', () => {
  assert.match(legacyApiProductionEnv, /SUPERSEDED/);
  assert.match(legacyApiProductionEnv, /deploy\/v2\/\.env\.example/);
  assert.doesNotMatch(legacyApiProductionEnv, /^[A-Z][A-Z0-9_]*=/m);
});

test('docker compose config fails when a required variable is missing', () => {
  const fixture = fs.readFileSync(new URL('./.env.synthetic', import.meta.url), 'utf8');
  const tempDir = mkdtempSync(path.join(tmpdir(), 'oasis-compose-'));
  const envFile = path.join(tempDir, 'deploy.env');
  writeFileSync(
    envFile,
    fixture
      .split(/\r?\n/)
      .filter((line) => !line.startsWith('NEXT_PUBLIC_CLERK_SIGN_UP_URL='))
      .join('\n'),
  );

  const result = spawnSync('docker', ['compose', '--env-file', envFile, '-f', path.join(deployDir, 'docker-compose.yml'), 'config'], {
    cwd: path.resolve(deployDir, '../..'),
    encoding: 'utf8',
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
    },
  });

  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stderr, /NEXT_PUBLIC_CLERK_SIGN_UP_URL is required/);
});
