import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCallbackUrl } from './callback-url';

test('normalizeCallbackUrl accepts and normalizes internal Oasis paths', () => {
  const acceptedCases = [
    ['/today', '/today'],
    ['/family/care-rooms/room-1?view=updates#latest', '/family/care-rooms/room-1?view=updates#latest'],
    ['/schedule/../today', '/today'],
    ['/people?q=Mary Smith', '/people?q=Mary%20Smith'],
  ] as const;

  for (const [value, expected] of acceptedCases) {
    assert.equal(normalizeCallbackUrl(value), expected, value);
  }
});

test('normalizeCallbackUrl accepts same-origin absolute redirects when the app origin is explicit', () => {
  assert.equal(
    normalizeCallbackUrl(
      'https://care.example.org/today?from=login#next',
      'https://care.example.org',
    ),
    '/today?from=login#next',
  );
  assert.equal(
    normalizeCallbackUrl('http://localhost:3002/today', 'http://localhost:3002'),
    '/today',
  );
});

test('normalizeCallbackUrl rejects external, schemed and malformed values', () => {
  const rejectedCases = [
    null,
    '',
    'today',
    'https://attacker.example/steal',
    'javascript:alert(1)',
    '//attacker.example/steal',
    '///attacker.example/steal',
    '/\\attacker.example/steal',
    '/%5cattacker.example/steal',
    '/today%0aSet-Cookie:unsafe',
    '/today%',
    '/today\u0000unsafe',
  ] as const;

  for (const value of rejectedCases) {
    assert.equal(
      normalizeCallbackUrl(value, 'https://care.example.org'),
      '/access',
      String(value),
    );
  }

  assert.equal(
    normalizeCallbackUrl(
      'https://attacker.example/steal',
      'https://care.example.org',
    ),
    '/access',
  );
});
