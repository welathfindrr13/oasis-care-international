import type { Client } from './graphql/queries'

export interface ClientProfileCompletenessItem {
  key: string
  label: string
  description: string
}

interface ClientProfileFieldDefinition {
  key: string
  label: string
  description: string
  isMissing: (client: Client) => boolean
}

const PROFILE_FIELDS: ClientProfileFieldDefinition[] = [
  {
    key: 'preferredName',
    label: 'Preferred name',
    description: 'Record how staff should address the client during visits and care-plan guidance.',
    isMissing: (client) => !client.preferredName?.trim(),
  },
  {
    key: 'dateOfBirth',
    label: 'Date of birth',
    description: 'Keep the long-lived client identity record complete for care planning and compliance handling.',
    isMissing: (client) => !client.dateOfBirth,
  },
  {
    key: 'preferredLanguage',
    label: 'Preferred language',
    description: 'Make the client’s usual spoken language visible before visits and medication prompts.',
    isMissing: (client) => !client.preferredLanguage?.trim(),
  },
  {
    key: 'communicationNeeds',
    label: 'Communication needs',
    description: 'Give carers clear direction on how to explain support, prompts, and medication.',
    isMissing: (client) => !client.communicationNeeds?.trim(),
  },
  {
    key: 'accessibilityAdjustments',
    label: 'Accessibility adjustments',
    description: 'Keep the practical adjustments carers should follow visible on the record.',
    isMissing: (client) => !client.accessibilityAdjustments?.trim(),
  },
  {
    key: 'representativeDetails',
    label: 'Representative details',
    description: 'Capture a named representative, their relationship, and at least one reliable contact method.',
    isMissing: (client) =>
      !client.representativeName?.trim() ||
      !client.representativeRelationship?.trim() ||
      (!client.representativePhone?.trim() && !client.representativeEmail?.trim()),
  },
]

export function getClientProfileCompleteness(client: Client) {
  const missingItems: ClientProfileCompletenessItem[] = PROFILE_FIELDS.filter((field) => field.isMissing(client)).map(
    ({ key, label, description }) => ({
      key,
      label,
      description,
    })
  )

  return {
    missingItems,
    missingCount: missingItems.length,
    totalCount: PROFILE_FIELDS.length,
    isComplete: missingItems.length === 0,
  }
}
