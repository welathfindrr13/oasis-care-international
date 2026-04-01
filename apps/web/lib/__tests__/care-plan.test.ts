import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRiskAndRedFlagLines, getCarePlanHighlights } from '../care-plan'
import type { CarePlanVersion } from '../graphql/queries'

function buildVersion(overrides: Partial<CarePlanVersion> = {}): CarePlanVersion {
  return {
    id: 'version-1',
    carePlanId: 'care-plan-1',
    versionNumber: 1,
    status: 'ACTIVE',
    authoredBy: 'admin-1',
    approvedAt: '2026-04-01T09:00:00.000Z',
    reviewDueAt: '2026-07-01T00:00:00.000Z',
    effectiveFrom: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: '2026-04-01T09:00:00.000Z',
    content: {
      overview: { summary: 'Summary', strengths: [], preferences: [] },
      goalsAndOutcomes: { goals: [], desiredOutcomes: [] },
      dailyRoutines: { morning: 'Morning support', midday: '', evening: '', overnight: '' },
      personalCareSupport: { bathing: '', dressing: '', toileting: '', grooming: '' },
      mobilityAndTransfers: { mobilitySummary: '', transferGuidance: '', equipment: [] },
      nutritionAndHydration: { nutritionSummary: '', hydrationSupport: '', dietaryNeeds: [] },
      medicationSupport: { levelOfSupport: '', keyInstructions: '', refusalEscalation: '' },
      communicationAndAccessibility: {
        communicationApproach: 'Speak clearly.',
        communicationNeeds: [],
        accessibilityAdjustments: [],
      },
      risksAndRedFlags: {
        items: [
          {
            title: 'Unsteady transfer',
            guidance: 'Pause the transfer and keep the client seated.',
            escalationTrigger: 'Balance worsens or there is any fall risk',
          },
        ],
      },
      contingencyAndEscalation: { summary: 'Call the coordinator.', actions: [], escalationTriggers: [] },
      representativesAndInvolvement: { summary: '', involvedPeople: [] },
    },
    ...overrides,
  }
}

test('formats risk and escalation lines as distinct bullets', () => {
  const lines = formatRiskAndRedFlagLines({
    title: 'Unsteady transfer',
    guidance: 'Pause the transfer and keep the client seated.',
    escalationTrigger: 'Balance worsens or there is any fall risk',
  })

  assert.deepEqual(lines, [
    'Risk: Unsteady transfer',
    'Guidance: Pause the transfer and keep the client seated.',
    'Escalate when: Balance worsens or there is any fall risk',
  ])
})

test('includes a risk and escalation highlight when the active care plan contains one', () => {
  const highlights = getCarePlanHighlights(buildVersion())

  assert.ok(highlights.some((item) => item.label === 'Risk and escalation'))
})
