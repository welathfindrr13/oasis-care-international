import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRecordedVisitCare } from './visitProgress';

test('a guided non-DONE outcome advances the visit workflow', () => {
  assert.equal(
    hasRecordedVisitCare(
      [{ isCompleted: false, hasRecordedOutcome: true }],
      0,
    ),
    true,
  );
});

test('a legacy completed task without an outcome marker still advances', () => {
  assert.equal(
    hasRecordedVisitCare(
      [{ isCompleted: true, hasRecordedOutcome: false }],
      0,
    ),
    true,
  );
});

test('an untouched task with no care log does not advance', () => {
  assert.equal(
    hasRecordedVisitCare(
      [{ isCompleted: false, hasRecordedOutcome: false }],
      0,
    ),
    false,
  );
});
