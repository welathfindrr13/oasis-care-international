import test from 'node:test'
import assert from 'node:assert/strict'
import type { Visit } from '../../../lib/graphql/queries'
import { getVisitQueueState } from '../queue-state'

function buildVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'visit-1',
    carerId: 'carer-1',
    clientId: 'client-1',
    scheduledStart: '2026-03-29T18:00:00.000Z',
    scheduledEnd: '2026-03-29T19:00:00.000Z',
    status: 'SCHEDULED',
    notes: '',
    tasks: [],
    createdAt: '2026-03-29T10:00:00.000Z',
    updatedAt: '2026-03-29T10:00:00.000Z',
    ...overrides,
  }
}

test('classifies a future scheduled visit as upcoming', () => {
  const visit = buildVisit({
    scheduledStart: '2026-03-29T20:00:00.000Z',
    scheduledEnd: '2026-03-29T21:00:00.000Z',
  })

  assert.equal(getVisitQueueState(visit, new Date('2026-03-29T19:00:00.000Z')), 'upcoming')
})

test('classifies a scheduled visit in its live window as needs_action_now', () => {
  const visit = buildVisit()

  assert.equal(getVisitQueueState(visit, new Date('2026-03-29T18:30:00.000Z')), 'needs_action_now')
})

test('classifies an unfinished scheduled visit after its window as overdue', () => {
  const visit = buildVisit()

  assert.equal(getVisitQueueState(visit, new Date('2026-03-29T19:30:00.000Z')), 'overdue')
})

test('classifies a scheduled visit with completed tasks as needs_review', () => {
  const visit = buildVisit({
    tasks: [
      {
        id: 'task-1',
        taskName: 'Check hydration',
        isCompleted: true,
        createdAt: '2026-03-29T10:00:00.000Z',
        updatedAt: '2026-03-29T18:15:00.000Z',
      },
    ],
  })

  assert.equal(getVisitQueueState(visit, new Date('2026-03-29T18:30:00.000Z')), 'needs_review')
})

test('classifies a scheduled visit with actual timing as needs_review', () => {
  const visit = buildVisit({
    actualStart: '2026-03-29T18:10:00.000Z',
  })

  assert.equal(getVisitQueueState(visit, new Date('2026-03-29T18:30:00.000Z')), 'needs_review')
})
