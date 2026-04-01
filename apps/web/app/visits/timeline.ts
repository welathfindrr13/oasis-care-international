import type { MedicationAdministration, Visit } from '../../lib/graphql/queries'
import { formatDateTime } from '../../lib/time'

export interface VisitTimelineEvent {
  id: string
  at: string
  title: string
  detail: string
}

export interface VisitTimelineGroups {
  planned: VisitTimelineEvent[]
  recorded: VisitTimelineEvent[]
}

function toTimestamp(value?: string | null) {
  return value ? new Date(value).getTime() : null
}

function summariseNote(note?: string | null) {
  const cleaned = note?.trim()
  if (!cleaned) {
    return null
  }

  if (cleaned.length <= 120) {
    return cleaned
  }

  return `${cleaned.slice(0, 117)}...`
}

export function buildVisitTimelineGroups(
  visit: Pick<Visit, 'id' | 'scheduledStart' | 'actualStart' | 'actualEnd' | 'updatedAt' | 'notes'> & {
    tasks: Visit['tasks']
  },
  medications: MedicationAdministration[]
): VisitTimelineGroups {
  const planned: VisitTimelineEvent[] = [
    {
      id: `${visit.id}-scheduled`,
      at: visit.scheduledStart,
      title: 'Planned visit window',
      detail: `Scheduled to start at ${formatDateTime(visit.scheduledStart)}`,
    },
    ...medications
      .filter((administration) => administration.status === 'SCHEDULED')
      .map((administration) => ({
        id: `${administration.id}-scheduled`,
        at: administration.scheduledTime,
        title: `Medication scheduled: ${administration.prescription?.medication?.name || 'Medication'}`,
        detail:
          administration.instructionSnapshot ||
          administration.prescription?.specialInstructions ||
          administration.prescription?.medication?.instructions ||
          'No extra medication notes recorded.',
      })),
  ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())

  const recorded: VisitTimelineEvent[] = [
    ...(visit.actualStart
      ? [
          {
            id: `${visit.id}-actual-start`,
            at: visit.actualStart,
            title: 'Visit started',
            detail: `Carer started the visit at ${formatDateTime(visit.actualStart)}`,
          },
        ]
      : []),
    ...(visit.actualEnd
      ? [
          {
            id: `${visit.id}-actual-end`,
            at: visit.actualEnd,
            title: 'Visit completed',
            detail: `Visit finished at ${formatDateTime(visit.actualEnd)}`,
          },
        ]
      : []),
    ...(visit.notes?.trim()
      ? [
          {
            id: `${visit.id}-notes`,
            at: visit.updatedAt,
            title: 'Care log updated',
            detail: 'Visit notes were last updated on this record.',
          },
        ]
      : []),
    ...visit.tasks.flatMap((task) => {
      const items: VisitTimelineEvent[] = []
      const taskNote = summariseNote(task.notes)
      const updatedAt = toTimestamp(task.updatedAt)
      const completedAt = toTimestamp(task.completedAt)

      if (task.completedAt) {
        items.push({
          id: `${task.id}-completed`,
          at: task.completedAt,
          title: `Task completed: ${task.taskName}`,
          detail: taskNote || 'Task marked as completed.',
        })
      }

      if (taskNote && updatedAt && updatedAt !== completedAt) {
        items.push({
          id: `${task.id}-notes`,
          at: task.updatedAt,
          title: `Task notes updated: ${task.taskName}`,
          detail: taskNote,
        })
      }

      return items
    }),
    ...medications
      .filter((administration) => administration.status !== 'SCHEDULED')
      .map((administration) => ({
        id: administration.id,
        at: administration.administeredTime || administration.scheduledTime,
        title:
          administration.status === 'ADMINISTERED'
            ? `Medication administered: ${administration.prescription?.medication?.name || 'Medication'}`
            : `Medication ${administration.status.toLowerCase()}: ${administration.prescription?.medication?.name || 'Medication'}`,
        detail:
          administration.notes?.trim() ||
          administration.instructionSnapshot ||
          administration.prescription?.specialInstructions ||
          administration.prescription?.medication?.instructions ||
          'No extra medication notes recorded.',
      })),
  ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())

  return {
    planned,
    recorded,
  }
}
