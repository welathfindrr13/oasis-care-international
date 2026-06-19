import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationsDir = new URL('./migrations', import.meta.url).pathname;

function readMigrationSql() {
  return readdirSync(migrationsDir)
    .map((entry) => join(migrationsDir, entry, 'migration.sql'))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    })
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');
}

test('CareBridge tables declared in schema are created by migrations', () => {
  const sql = readMigrationSql();
  const requiredTables = [
    'family_contact',
    'care_room',
    'care_room_membership',
    'access_grant',
    'carebridge_policy',
    'verified_visit_story',
    'concern',
    'concern_message',
    'concern_event',
    'weekly_care_summary',
    'family_pulse',
  ];

  for (const table of requiredTables) {
    assert.match(sql, new RegExp(`CREATE TABLE "${table}"`), `Missing migration for ${table}`);
  }
});
