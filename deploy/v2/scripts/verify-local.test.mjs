import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('./verify-local.sh', import.meta.url), 'utf8');

test('local Deployment V2 compose verification uses the generated env file', () => {
  assert.match(script, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});
