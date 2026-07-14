import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const queries = readFileSync(new URL('../../lib/graphql/queries.ts', import.meta.url), 'utf8');

test('requires an exact shift ID in the clock-out GraphQL contract', () => {
  assert.match(queries, /mutation ClockOut\(\$input: ClockOutInput!\)/);
  assert.match(page, /if \(!activeShift\?\.id\)/);
  assert.match(page, /input:\s*{\s*shiftId: activeShift\.id,/);
});

test('Refresh genuinely reloads both supported shift queries', () => {
  assert.match(
    page,
    /Promise\.all\(\[\s*clientQuery<MyActiveShiftQueryResponse>\(MY_ACTIVE_SHIFT_QUERY\),\s*clientQuery<MyRecentShiftsQueryResponse>\(MY_RECENT_SHIFTS_QUERY,/,
  );
  assert.match(page, /onClick={loadData}/);
  assert.match(page, /aria-label="Refresh shift status and recent shifts"/);
  assert.match(page, /disabled={loading \|\| submitting}/);
});
