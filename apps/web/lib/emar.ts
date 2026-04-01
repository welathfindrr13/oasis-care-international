export type EmarMedicationStatus = 'SCHEDULED' | 'ADMINISTERED' | 'MISSED' | 'REFUSED' | 'CANCELLED'

export interface EmarMedicationRowInput {
  status: EmarMedicationStatus
  visit?: {
    scheduledStart: string
    scheduledEnd: string
  } | null
}

export type EmarRowPosture = 'linked_scheduled' | 'unlinked_scheduled' | 'recorded' | 'cancelled'

export function getEmarRowPosture(input: EmarMedicationRowInput): EmarRowPosture {
  if (input.status === 'CANCELLED') {
    return 'cancelled'
  }

  if (input.status !== 'SCHEDULED') {
    return 'recorded'
  }

  return input.visit ? 'linked_scheduled' : 'unlinked_scheduled'
}

export function describeEmarRowPosture(input: EmarMedicationRowInput) {
  const posture = getEmarRowPosture(input)

  switch (posture) {
    case 'linked_scheduled':
      return {
        posture,
        label: 'Linked visit',
        description: 'Record the outcome here or from the linked visit workspace.',
      }
    case 'unlinked_scheduled':
      return {
        posture,
        label: 'No linked visit',
        description: 'This administration stays read-only here until it is attached to a visit.',
      }
    case 'cancelled':
      return {
        posture,
        label: 'Cancelled administration',
        description: 'This scheduled dose is no longer active.',
      }
    default:
      return {
        posture,
        label: 'Outcome recorded',
        description: 'The medication outcome has already been captured on the record.',
      }
  }
}
