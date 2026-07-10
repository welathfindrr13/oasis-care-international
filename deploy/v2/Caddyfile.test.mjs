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

test('Caddy routes public company requests directly to the API before the web catch-all', () => {
  const requestRouteIndex = caddyfile.indexOf('handle /api/company-access-requests');
  const catchAllIndex = caddyfile.indexOf('handle {');

  assert.notEqual(requestRouteIndex, -1);
  assert.match(caddyfile.slice(requestRouteIndex, catchAllIndex), /uri strip_prefix \/api/);
  assert(requestRouteIndex < catchAllIndex);
});
