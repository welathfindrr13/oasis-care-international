import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const caddyfile = fs.readFileSync(new URL('./Caddyfile', import.meta.url), 'utf8');

test('Caddy routes stats REST traffic to the API before the web catch-all', () => {
  const statsRouteIndex = caddyfile.indexOf('handle /stats/*');
  const catchAllIndex = caddyfile.indexOf('handle {');

  assert.notEqual(statsRouteIndex, -1);
  assert.notEqual(catchAllIndex, -1);
  assert(statsRouteIndex < catchAllIndex);
});
