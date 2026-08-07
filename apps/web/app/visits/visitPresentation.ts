const VISIT_TASK_OUTCOME_PREFIX = 'VISIT_TASK_OUTCOME::';

function taskOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'DONE':
      return 'Done';
    case 'NOT_DONE':
      return 'Not done';
    case 'REFUSED':
      return 'Refused';
    case 'NOT_REQUIRED':
      return 'Not required';
    case 'CONCERN_RAISED':
      return 'Concern raised';
    default:
      return 'Outcome recorded';
  }
}

export type VisitTaskUpdatePresentation = {
  outcomeLabel: string | null;
  note: string | null;
};

export function presentVisitTaskUpdate(
  notes: string | null | undefined,
  isCompleted = false,
): VisitTaskUpdatePresentation {
  let outcomeLabel: string | null = null;
  const visibleLines: string[] = [];

  for (const line of (notes || '').split('\n')) {
    const normalized = line.trim();
    if (!normalized) continue;

    if (normalized.startsWith(VISIT_TASK_OUTCOME_PREFIX)) {
      try {
        const metadata = JSON.parse(
          normalized.slice(VISIT_TASK_OUTCOME_PREFIX.length),
        ) as { outcome?: unknown };
        if (typeof metadata.outcome === 'string') {
          outcomeLabel = taskOutcomeLabel(metadata.outcome);
        }
      } catch {
        // Machine metadata is never rendered, even when it is malformed.
      }
      continue;
    }

    visibleLines.push(normalized);
  }

  return {
    outcomeLabel: outcomeLabel || (isCompleted ? 'Done' : null),
    note: visibleLines.length > 0 ? visibleLines.join(' ') : null,
  };
}

export function visitStartSummary(
  status: 'IN_PROGRESS' | 'COMPLETED',
  formattedStart: string,
): string {
  return status === 'COMPLETED'
    ? `Visit completed. Started at ${formattedStart}.`
    : `Visit is active. Started at ${formattedStart}.`;
}
