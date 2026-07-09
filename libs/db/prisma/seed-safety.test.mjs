import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const seedSource = fs.readFileSync(new URL('./seed.ts', import.meta.url), 'utf8');

test('Prisma seed refuses production and staging before creating a Prisma client', () => {
  const guardIndex = seedSource.indexOf('assertSeedAllowed');
  const clientIndex = seedSource.indexOf('new PrismaClient');

  assert.notEqual(guardIndex, -1);
  assert.notEqual(clientIndex, -1);
  assert(
    guardIndex < clientIndex,
    'seed safety guard must run before opening any database connection',
  );
  assert.match(seedSource, /NODE_ENV/);
  assert.match(seedSource, /production|staging/);
});

test('Prisma seed requires explicit local confirmation', () => {
  assert.match(seedSource, /OASIS_ALLOW_DEMO_SEED/);
  assert.match(seedSource, /I_UNDERSTAND_THIS_RESETS_LOCAL_DEMO_DATA/);
});

test('Prisma seed has no reachable unscoped destructive deleteMany path before the guard', () => {
  const guardIndex = seedSource.indexOf('assertSeedAllowed');
  const firstDeleteManyIndex = seedSource.indexOf('.deleteMany(');

  assert.notEqual(guardIndex, -1);
  assert.notEqual(firstDeleteManyIndex, -1);
  assert(
    guardIndex < firstDeleteManyIndex,
    'seed safety guard must precede any deleteMany call',
  );
});

test('Prisma seed exits before database work in production', () => {
  const result = spawnSync('node_modules/.bin/tsx', ['libs/db/prisma/seed.ts'], {
    cwd: new URL('../../..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      OASIS_ALLOW_DEMO_SEED: 'I_UNDERSTAND_THIS_RESETS_LOCAL_DEMO_DATA',
    },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /disabled in production, staging/);
  assert.doesNotMatch(`${result.stderr}\n${result.stdout}`, /Seeding demo database/);
});
