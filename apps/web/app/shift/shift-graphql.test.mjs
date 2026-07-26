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
  assert.match(page, /void loadData\(\)/);
  assert.match(page, /aria-label="Refresh shift status and recent shifts"/);
  assert.match(page, /disabled={loading \|\| submitting}/);
});

test('shift feedback and consent remain accessible', () => {
  assert.match(page, /<Alert\s+tone="danger"/);
  assert.match(page, /<Alert tone="success" live/);
  assert.match(page, /className="flex min-h-11 cursor-pointer/);
  assert.match(
    page,
    /Clocking in and out needs an internet connection\./,
  );
});

test('clock-in and clock-out share the ref-backed single-flight boundary', () => {
  assert.match(page, /const shiftActionStartedRef = useRef\(false\)/);
  assert.equal(
    page.match(/runSingleFlightAction\(shiftActionStartedRef/g)?.length,
    2,
  );
});
