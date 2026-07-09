import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const seedSource = fs.readFileSync(new URL('./seed.ts', import.meta.url), 'utf8');

test('Prisma seed refuses production and staging before creating a Prisma client', () => {
  assert.match(seedSource, /NODE_ENV/);
  assert.match(seedSource, /production|staging/);
  assert.doesNotMatch(seedSource, /new PrismaClient/);
});

test('Prisma seed is a no-op with no destructive database calls', () => {
  assert.doesNotMatch(seedSource, /deleteMany|createMany|upsert|create\(|updateMany|new PrismaClient/);
  assert.match(seedSource, /No demo seed data is created/);
});

test('Prisma seed exits before database work in production and staging', () => {
  const result = spawnSync('node_modules/.bin/tsx', ['libs/db/prisma/seed.ts'], {
    cwd: new URL('../../..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /disabled in production, staging/);
  assert.doesNotMatch(`${result.stderr}\n${result.stdout}`, /PrismaClient|Seeding demo database/);
});

test('Prisma seed no-ops in local test mode', () => {
  const result = spawnSync('node_modules/.bin/tsx', ['libs/db/prisma/seed.ts'], {
    cwd: new URL('../../..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /No demo seed data is created/);
  assert.doesNotMatch(`${result.stderr}\n${result.stdout}`, /deleteMany|PrismaClient/);
});
