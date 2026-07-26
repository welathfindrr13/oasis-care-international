import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname);

function source(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('care-planning and inspection records distinguish unavailable data and preserve client context on retry', () => {
  for (const [relativePath, route] of [
    ['care-planning/page.tsx', '/care-planning'],
    ['evidence/page.tsx', '/evidence'],
  ]) {
    const page = source(relativePath);
    assert.match(page, /StatePanel/);
    assert.match(page, /kind="unavailable"/);
    assert.match(page, new RegExp(`form action="${route}" method="get"`));
    assert.match(page, /name="clientId"/);
    assert.match(page, /No\s+changes\s+can be made until the connection recovers/);
  }
});

test('Family access and workforce analytics never report API failures as empty or zero activity', () => {
  const carebridge = source('carebridge/page.tsx');
  const analytics = source('admin/analytics/page.tsx');

  assert.match(carebridge, /unavailable: true/);
  assert.match(carebridge, /This is not an empty room list/);
  assert.match(analytics, /analytics: null, unavailable: true/);
  assert.doesNotMatch(analytics, /activeCarersNow:\s*0/);
  assert.match(analytics, /The service is not reporting zero activity/);
});
