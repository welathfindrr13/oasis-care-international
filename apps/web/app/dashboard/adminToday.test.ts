import assert from 'node:assert/strict'
import test from 'node:test'
import type { Visit } from '../../lib/graphql/queries'
import { getAssignmentNotReadyVisits, getRemainingVisitPageOffsets } from './adminToday'

function visit(id: string, carerId: string, status: Visit['status']): Visit {
  return { id, carerId, status } as Visit
}

test('visit pagination requests every page after the first hundred', () => {
  assert.deepEqual(getRemainingVisitPageOffsets(0, 100), [])
  assert.deepEqual(getRemainingVisitPageOffsets(100, 100), [])
  assert.deepEqual(getRemainingVisitPageOffsets(101, 100), [100])
  assert.deepEqual(getRemainingVisitPageOffsets(250, 100), [100, 200])
})

test('assignment exceptions use lifecycle readiness and ignore finished work', () => {
  const visits = [
    visit('ready', 'carer-ready', 'SCHEDULED'),
    visit('not-ready', 'carer-disabled', 'SCHEDULED'),
    visit('in-progress-not-ready', 'carer-disabled', 'IN_PROGRESS'),
    visit('completed', 'carer-disabled', 'COMPLETED'),
    visit('cancelled', 'carer-disabled', 'CANCELLED'),
  ]
  assert.deepEqual(
    getAssignmentNotReadyVisits(visits, ['carer-ready']).map((item) => item.id),
    ['not-ready', 'in-progress-not-ready'],
  )
})
