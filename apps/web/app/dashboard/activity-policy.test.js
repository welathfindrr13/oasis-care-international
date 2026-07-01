const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

test('dashboard routes staff activity links through the policy helper', () => {
  assert.match(source, /const activityHref = isAdmin \? '\/activity' : '\/today'/);
  assert.doesNotMatch(source, /href="\/activity"/);
});
