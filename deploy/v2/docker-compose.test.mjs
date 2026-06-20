import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compose = fs.readFileSync(new URL('./docker-compose.yml', import.meta.url), 'utf8');

test('Caddy receives public domain environment used by the Caddyfile', () => {
  const caddyBlock = compose.slice(compose.indexOf('  caddy:'), compose.indexOf('  web:'));

  assert.match(caddyBlock, /environment:/);
  assert.match(caddyBlock, /APP_DOMAIN:\s*\$\{APP_DOMAIN/);
  assert.match(caddyBlock, /ACME_EMAIL:\s*\$\{ACME_EMAIL/);
});
