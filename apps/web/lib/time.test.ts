import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatDate,
  formatLondonLongDate,
  formatOrganizationDateTimeInput,
  formatTime,
  getOrganizationDateUtcRange,
  getOrganizationMonthUtcRange,
  getOrganizationWeekUtcRange,
  getLondonDayUtcRange,
  organizationDateKey,
  organizationDateTimeInputToIso,
} from './time'

test('formats visit dates and times explicitly in Europe/London', () => {
  assert.equal(formatTime('2026-07-12T12:00:00.000Z'), '13:00')
  assert.equal(
    formatLondonLongDate('2026-07-12T12:00:00.000Z'),
    'Sunday, 12 July 2026',
  )
})

test('constructs London calendar-day UTC ranges across GMT and BST', () => {
  assert.deepEqual(getLondonDayUtcRange(new Date('2026-01-12T12:00:00.000Z')), {
    start: '2026-01-12T00:00:00.000Z',
    end: '2026-01-13T00:00:00.000Z',
  })
  assert.deepEqual(getLondonDayUtcRange(new Date('2026-07-12T12:00:00.000Z')), {
    start: '2026-07-11T23:00:00.000Z',
    end: '2026-07-12T23:00:00.000Z',
  })
  assert.deepEqual(getLondonDayUtcRange(new Date('2026-03-29T12:00:00.000Z')), {
    start: '2026-03-29T00:00:00.000Z',
    end: '2026-03-29T23:00:00.000Z',
  })
  assert.deepEqual(getLondonDayUtcRange(new Date('2026-10-25T12:00:00.000Z')), {
    start: '2026-10-24T23:00:00.000Z',
    end: '2026-10-26T00:00:00.000Z',
  })
})

test('keeps Manager and Family rendering on the organization calendar', () => {
  const afterLondonMidnight = '2026-07-12T23:30:00.000Z'
  assert.equal(formatDate(afterLondonMidnight), '13 Jul 2026')
  assert.equal(formatTime(afterLondonMidnight), '00:30')
  assert.equal(organizationDateKey(afterLondonMidnight), '2026-07-13')
  assert.deepEqual(getOrganizationDateUtcRange('2026-07-13'), {
    start: '2026-07-12T23:00:00.000Z',
    end: '2026-07-13T23:00:00.000Z',
  })
  assert.deepEqual(getOrganizationWeekUtcRange(new Date('2026-03-29T12:00:00.000Z')), {
    start: '2026-03-29T00:00:00.000Z',
    end: '2026-04-04T23:00:00.000Z',
  })
  assert.deepEqual(getOrganizationMonthUtcRange(2026, 7), {
    start: '2026-06-30T23:00:00.000Z',
    end: '2026-07-31T23:00:00.000Z',
  })
})

test('converts organization wall time to UTC and rejects DST ambiguity', () => {
  assert.equal(
    organizationDateTimeInputToIso('2026-07-12T08:00'),
    '2026-07-12T07:00:00.000Z',
  )
  assert.equal(
    formatOrganizationDateTimeInput('2026-07-12T07:00:00.000Z'),
    '2026-07-12T08:00',
  )
  assert.throws(
    () => organizationDateTimeInputToIso('2026-10-25T01:30'),
    /occurs twice/,
  )
  assert.throws(
    () => organizationDateTimeInputToIso('2026-03-29T01:30'),
    /does not exist/,
  )
})
