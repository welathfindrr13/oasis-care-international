import assert from 'node:assert/strict';
import test from 'node:test';
import { hasRecordedVisitCare } from './visitProgress';
import {
  presentVisitTaskUpdate,
  visitStartSummary,
} from './visitPresentation';

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

test('operational task presentation keeps the human update and redacts audit metadata', () => {
  const membershipId = '7b326b18-d9d2-4ff0-a329-03c60f6c7ee6';
  const rawNotes = [
    'Completed during visit: Support with fictional breakfast',
    `VISIT_TASK_OUTCOME::{"outcome":"DONE","recordedAt":"2026-08-07T09:00:00.000Z","recordedBy":"${membershipId}"}`,
  ].join('\n');

  const presentation = presentVisitTaskUpdate(rawNotes);

  assert.deepEqual(presentation, {
    outcomeLabel: 'Done',
    note: 'Completed during visit: Support with fictional breakfast',
  });
  assert.doesNotMatch(JSON.stringify(presentation), /VISIT_TASK_OUTCOME/);
  assert.doesNotMatch(JSON.stringify(presentation), new RegExp(membershipId));
});

test('all guided task outcomes remain available as plain-language operational text', () => {
  const expected: Array<[string, string]> = [
    ['DONE', 'Done'],
    ['NOT_DONE', 'Not done'],
    ['REFUSED', 'Refused'],
    ['NOT_REQUIRED', 'Not required'],
    ['CONCERN_RAISED', 'Concern raised'],
  ];

  for (const [outcome, label] of expected) {
    assert.equal(
      presentVisitTaskUpdate(
        `VISIT_TASK_OUTCOME::{"outcome":"${outcome}","recordedBy":"internal-id"}`,
      ).outcomeLabel,
      label,
    );
  }
});

test('a legacy completed task without audit metadata still renders Done', () => {
  assert.deepEqual(
    presentVisitTaskUpdate('Legacy completion note', true),
    { outcomeLabel: 'Done', note: 'Legacy completion note' },
  );
});

test('malformed metadata is hidden and unknown outcomes use a safe label', () => {
  assert.deepEqual(
    presentVisitTaskUpdate('Care action recorded\nVISIT_TASK_OUTCOME::{bad-json'),
    { outcomeLabel: null, note: 'Care action recorded' },
  );
  assert.deepEqual(
    presentVisitTaskUpdate(
      'VISIT_TASK_OUTCOME::{"outcome":"FUTURE_OUTCOME","recordedBy":"internal-id"}',
    ),
    { outcomeLabel: 'Outcome recorded', note: null },
  );
  assert.deepEqual(
    presentVisitTaskUpdate(
      'VISIT_TASK_OUTCOME::{"outcome":"constructor","recordedBy":"internal-id"}',
    ),
    { outcomeLabel: 'Outcome recorded', note: null },
  );
});

test('completed visit start copy cannot describe the visit as active', () => {
  const completed = visitStartSummary('COMPLETED', '7 August 2026 at 09:00');
  const active = visitStartSummary('IN_PROGRESS', '7 August 2026 at 09:00');

  assert.equal(
    completed,
    'Visit completed. Started at 7 August 2026 at 09:00.',
  );
  assert.doesNotMatch(completed, /active/i);
  assert.equal(
    active,
    'Visit is active. Started at 7 August 2026 at 09:00.',
  );
});
