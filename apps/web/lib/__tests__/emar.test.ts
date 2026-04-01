import test from 'node:test'
import assert from 'node:assert/strict'
import { describeEmarRowPosture, getEmarRowPosture } from '../emar'

test('marks a scheduled medication with a linked visit as linked_scheduled', () => {
  assert.equal(
    getEmarRowPosture({
      status: 'SCHEDULED',
      visit: {
        scheduledStart: '2026-04-01T09:00:00.000Z',
        scheduledEnd: '2026-04-01T10:00:00.000Z',
      },
    }),
    'linked_scheduled'
  )
})

test('marks a scheduled medication without a linked visit as unlinked_scheduled', () => {
  const posture = describeEmarRowPosture({
    status: 'SCHEDULED',
    visit: null,
  })

  assert.equal(posture.posture, 'unlinked_scheduled')
  assert.match(posture.description, /read-only here/i)
})

test('marks a recorded medication outcome as recorded', () => {
  assert.equal(getEmarRowPosture({ status: 'ADMINISTERED' }), 'recorded')
})
