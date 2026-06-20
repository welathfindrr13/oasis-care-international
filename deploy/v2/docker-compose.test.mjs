import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const compose = fs.readFileSync(new URL('./docker-compose.yml', import.meta.url), 'utf8');

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

  assert.match(webBlock, /CLERK_SECRET_KEY:\s*\$\{CLERK_SECRET_KEY/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:\s*\$\{NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_SIGN_IN_URL:\s*\$\{NEXT_PUBLIC_CLERK_SIGN_IN_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_SIGN_UP_URL:\s*\$\{NEXT_PUBLIC_CLERK_SIGN_UP_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:\s*\$\{NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL/);
  assert.match(webBlock, /NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:\s*\$\{NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL/);
});
