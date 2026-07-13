import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatInOrganizationTimezone,
  organizationDateKey,
  organizationDayUtcRange,
  organizationCalendarMonthUtcRange,
  organizationCompletedReportingPeriodUtcRange,
  organizationWeekUtcRange,
  resolveOrganizationTimezone,
  resolveOrganizationWallClock,
  type OrganizationTimezoneResolver,
} from './organization-timezone';

test('uses Europe/London for the UK pilot through one resolver boundary', () => {
  assert.equal(resolveOrganizationTimezone('org-pilot'), 'Europe/London');
});

test('allows a future organization resolver without a schema dependency', () => {
  const resolver: OrganizationTimezoneResolver = {
    resolve: () => 'America/New_York',
  };
  assert.equal(resolveOrganizationTimezone('org-future', resolver), 'America/New_York');
});

test('creates 23-hour and 25-hour London day ranges at BST boundaries', () => {
  const spring = organizationDayUtcRange(new Date('2026-03-29T12:00:00.000Z'));
  assert.equal(spring.start.toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(spring.end.toISOString(), '2026-03-29T23:00:00.000Z');

  const autumn = organizationDayUtcRange(new Date('2026-10-25T12:00:00.000Z'));
  assert.equal(autumn.start.toISOString(), '2026-10-24T23:00:00.000Z');
  assert.equal(autumn.end.toISOString(), '2026-10-26T00:00:00.000Z');
});

test('classifies missing and repeated London wall times without guessing', () => {
  assert.deepEqual(
    resolveOrganizationWallClock({
      year: 2026,
      month: 3,
      day: 29,
      hour: 1,
      minute: 30,
    }),
    { kind: 'nonexistent' },
  );
  const repeated = resolveOrganizationWallClock({
    year: 2026,
    month: 10,
    day: 25,
    hour: 1,
    minute: 30,
  });
  assert.equal(repeated.kind, 'ambiguous');
  if (repeated.kind === 'ambiguous') {
    assert.deepEqual(
      repeated.instants.map((instant) => instant.toISOString()),
      ['2026-10-25T00:30:00.000Z', '2026-10-25T01:30:00.000Z'],
    );
  }
});

test('assigns a visit after UTC midnight to the correct organization day', () => {
  const instant = new Date('2026-07-12T23:30:00.000Z');
  assert.equal(organizationDateKey(instant), '2026-07-13');
  assert.equal(
    formatInOrganizationTimezone(instant, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    '13 Jul 2026',
  );
});

test('constructs organization month and week ranges across a BST transition', () => {
  const month = organizationCalendarMonthUtcRange(2026, 3);
  assert.equal(month.start.toISOString(), '2026-03-01T00:00:00.000Z');
  assert.equal(month.end.toISOString(), '2026-03-31T23:00:00.000Z');

  const week = organizationWeekUtcRange(new Date('2026-03-29T12:00:00.000Z'));
  assert.equal(week.start.toISOString(), '2026-03-29T00:00:00.000Z');
  assert.equal(week.end.toISOString(), '2026-04-04T23:00:00.000Z');
});

test('keeps completed Friday-Thursday reporting periods separate from calendar weeks', () => {
  const reporting = organizationCompletedReportingPeriodUtcRange(
    new Date('2026-04-03T01:00:00.000Z'),
  );
  assert.equal(reporting.start.toISOString(), '2026-03-27T00:00:00.000Z');
  assert.equal(reporting.end.toISOString(), '2026-04-02T23:00:00.000Z');

  const resolver: OrganizationTimezoneResolver = {
    resolve: (organizationId) =>
      organizationId === 'org-new-york' ? 'America/New_York' : 'Europe/London',
  };
  const newYork = organizationCompletedReportingPeriodUtcRange(
    new Date('2026-04-03T12:00:00.000Z'),
    'org-new-york',
    resolver,
  );
  assert.equal(newYork.start.toISOString(), '2026-03-27T04:00:00.000Z');
  assert.equal(newYork.end.toISOString(), '2026-04-03T04:00:00.000Z');
});
