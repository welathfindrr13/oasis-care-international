const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8');

test('admin Today is limited to immediate visit and staffing operations', () => {
  assert.match(source, /SHIFT_ANALYTICS_QUERY/);
  assert.match(source, /VISITS_QUERY/);
  assert.match(source, /Late or missed visits/);
  assert.match(source, /Unassigned visits/);
  assert.match(source, /Incomplete visit records/);
  assert.doesNotMatch(source, /CARE_PLANNING_QUERY|VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY|CAREBRIDGE_CONCERN_INBOX_QUERY/);
  assert.doesNotMatch(source, /Medication exceptions|AI Health Summaries|Care plan reviews|Evidence gaps/);
});
