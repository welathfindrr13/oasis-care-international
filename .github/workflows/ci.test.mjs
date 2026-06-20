import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('./ci.yml', import.meta.url), 'utf8');

test('Deployment V2 CI compose verification uses the generated env file', () => {
  assert.match(workflow, /docker compose --env-file "\$TEMP_ENV" -f deploy\/v2\/docker-compose\.yml config/);
});
