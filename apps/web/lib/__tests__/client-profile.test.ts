import test from 'node:test'
import assert from 'node:assert/strict'
import type { Client } from '../graphql/queries'
import { getClientProfileCompleteness } from '../client-profile'

function buildClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    fullName: 'Test Client',
    addressLine1: '1 Test Street',
    city: 'London',
    postcode: 'E1 1AA',
    ...overrides,
  }
}

test('flags the operational profile fields still missing from the client record', () => {
  const completeness = getClientProfileCompleteness(buildClient())

  assert.equal(completeness.isComplete, false)
  assert.deepEqual(
    completeness.missingItems.map((item) => item.label),
    [
      'Preferred name',
      'Date of birth',
      'Preferred language',
      'Communication needs',
      'Accessibility adjustments',
      'Representative details',
    ]
  )
})

test('marks the client profile complete when operational details are filled', () => {
  const completeness = getClientProfileCompleteness(
    buildClient({
      preferredName: 'Pat',
      dateOfBirth: '1948-03-15T00:00:00.000Z',
      preferredLanguage: 'English',
      communicationNeeds: 'Face the client when speaking.',
      accessibilityAdjustments: 'Large-print written prompts.',
      representativeName: 'Avery Test',
      representativeRelationship: 'Niece',
      representativePhone: '07123 456789',
    })
  )

  assert.equal(completeness.isComplete, true)
  assert.equal(completeness.missingItems.length, 0)
})
