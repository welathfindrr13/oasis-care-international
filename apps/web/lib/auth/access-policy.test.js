const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'access.ts'), 'utf8');

test('route policy treats activity as admin-only after family redirects are resolved first', () => {
  assert.match(source, /const ADMIN_ONLY_PATHS = \[[\s\S]*\^\\\/activity\(\?:\\\/\|\$\)/);

  const externalBranchIndex = source.indexOf('if (context.isExternal)');
  const adminOnlyBranchIndex = source.indexOf('const isAdminOnlyPath');

  assert.notEqual(externalBranchIndex, -1);
  assert.notEqual(adminOnlyBranchIndex, -1);
  assert.ok(externalBranchIndex < adminOnlyBranchIndex);
});
