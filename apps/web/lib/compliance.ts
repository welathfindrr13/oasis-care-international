export interface ComplianceSubjectContext {
  id: string
  name?: string
}

export function getComplianceSubjectContext(searchParams?: {
  subjectId?: string
  subjectName?: string
}) {
  const id = searchParams?.subjectId?.trim()
  const name = searchParams?.subjectName?.trim()

  if (!id) {
    return null
  }

  return {
    id,
    name: name || undefined,
  } satisfies ComplianceSubjectContext
}

export function formatMaskedActorLabel(userId?: string | null) {
  if (!userId) {
    return 'Unknown staff record'
  }

  if (userId === 'anonymous') {
    return 'Anonymous system request'
  }

  if (userId.length <= 12) {
    return `Staff record ${userId}`
  }

  return `Staff record ${userId.slice(0, 8)}...${userId.slice(-4)}`
}
