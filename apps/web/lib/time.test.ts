import test from 'node:test'
import assert from 'node:assert/strict'

import { formatLondonLongDate, formatTime, getLondonDayUtcRange } from './time'

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
})
