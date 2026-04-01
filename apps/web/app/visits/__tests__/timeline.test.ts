import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVisitTimelineGroups } from '../timeline'
import type { MedicationAdministration, Visit } from '../../../lib/graphql/queries'

function buildVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 'visit-1',
    carerId: 'carer-1',
    clientId: 'client-1',
    scheduledStart: '2026-04-01T11:00:00.000Z',
    scheduledEnd: '2026-04-01T12:00:00.000Z',
    actualStart: '2026-04-01T10:42:00.000Z',
    actualEnd: '2026-04-01T10:46:00.000Z',
    status: 'COMPLETED',
    notes: 'Completed visit.',
    tasks: [],
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-04-01T10:46:00.000Z',
    ...overrides,
  }
}

test('keeps planned events ahead of recorded activity for an early-start visit', () => {
  const groups = buildVisitTimelineGroups(buildVisit(), [])

  assert.equal(groups.planned[0]?.title, 'Planned visit window')
  assert.equal(groups.recorded[0]?.title, 'Visit started')
})

test('places scheduled medications in the planned group and recorded outcomes in recorded activity', () => {
  const medications: MedicationAdministration[] = [
    {
      id: 'med-1',
      prescriptionId: 'rx-1',
      scheduledTime: '2026-04-01T09:00:00.000Z',
      status: 'SCHEDULED',
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-01T08:00:00.000Z',
      prescription: {
        id: 'rx-1',
        medication: { id: 'm-1', name: 'Morning tablet', dosage: '10', unit: 'mg' },
      },
    },
    {
      id: 'med-2',
      prescriptionId: 'rx-2',
      scheduledTime: '2026-04-01T09:15:00.000Z',
      administeredTime: '2026-04-01T10:45:00.000Z',
      status: 'ADMINISTERED',
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-01T10:45:00.000Z',
      prescription: {
        id: 'rx-2',
        medication: { id: 'm-2', name: 'Prompted dose', dosage: '5', unit: 'ml' },
      },
    },
  ]

  const groups = buildVisitTimelineGroups(buildVisit(), medications)

  assert.ok(groups.planned.some((event) => event.title.includes('Medication scheduled')))
  assert.ok(groups.recorded.some((event) => event.title.includes('Medication administered')))
})
