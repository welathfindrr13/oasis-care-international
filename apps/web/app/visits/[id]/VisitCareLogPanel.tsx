'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StatusChip } from '../../../components/oasis/StatusChip'
import { buttonVariants } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  SET_VISIT_TASK_COMPLETION_MUTATION,
  UPDATE_VISIT_MUTATION,
  type SetVisitTaskCompletionMutationResponse,
  type UpdateVisitMutationResponse,
  type Visit,
  type VisitTask,
} from '../../../lib/graphql/queries'
import { formatDateTime } from '../../../lib/time'
import { cn } from '../../../lib/utils'

interface VisitCareLogPanelProps {
  canEdit: boolean
  visit: Pick<Visit, 'id' | 'notes' | 'updatedAt'> & {
    tasks: Array<Pick<VisitTask, 'id' | 'taskName' | 'description' | 'isCompleted' | 'completedAt' | 'notes' | 'updatedAt'>>
  }
}

export function VisitCareLogPanel({ canEdit, visit }: VisitCareLogPanelProps) {
  const router = useRouter()
  const [notesDraft, setNotesDraft] = useState(visit.notes ?? '')
  const [savedNotes, setSavedNotes] = useState(visit.notes ?? '')
  const [tasks, setTasks] = useState(visit.tasks)
  const [error, setError] = useState<string | null>(null)
  const [notesMessage, setNotesMessage] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isSavingNotes, startSavingNotes] = useTransition()
  const [isUpdatingTask, startUpdatingTask] = useTransition()

  const hasUnsavedNotes = notesDraft !== savedNotes

  const saveNotes = () => {
    setError(null)
    setNotesMessage(null)

    startSavingNotes(async () => {
      try {
        const data = await clientQuery<UpdateVisitMutationResponse>(UPDATE_VISIT_MUTATION, {
          input: { id: visit.id, notes: notesDraft },
        })
        setSavedNotes(data.updateVisit.notes ?? '')
        setNotesDraft(data.updateVisit.notes ?? '')
        setNotesMessage('Visit notes saved.')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save visit notes')
      }
    })
  }

  const toggleTask = (task: VisitTask | VisitCareLogPanelProps['visit']['tasks'][number]) => {
    setError(null)
    setNotesMessage(null)
    setActiveTaskId(task.id)

    startUpdatingTask(async () => {
      try {
        const data = await clientQuery<SetVisitTaskCompletionMutationResponse>(
          SET_VISIT_TASK_COMPLETION_MUTATION,
          {
            taskId: task.id,
            isCompleted: !task.isCompleted,
            notes: task.notes ?? undefined,
          }
        )

        const updatedTask = data.setVisitTaskCompletion
        setTasks((current) =>
          current.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  isCompleted: updatedTask.isCompleted,
                  completedAt: updatedTask.completedAt,
                  notes: updatedTask.notes,
                  updatedAt: updatedTask.updatedAt,
                }
              : item
          )
        )
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update task status')
      } finally {
        setActiveTaskId(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-4 text-sm text-text-secondary">
          {canEdit
            ? 'Capture visit notes and task progress as the visit happens.'
            : 'Review the notes and task progress recorded for this visit.'}
        </p>

        {canEdit ? (
          <div className="space-y-3">
            <label htmlFor="visit-notes" className="text-sm font-medium text-text-primary">
              Visit notes
            </label>
            <textarea
              id="visit-notes"
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-text-primary shadow-sm outline-none transition focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-primary/20"
              placeholder="Record how the visit went, changes observed, and anything the next carer should know."
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
                onClick={saveNotes}
                disabled={isSavingNotes || !hasUnsavedNotes}
              >
                {isSavingNotes ? 'Saving…' : 'Save notes'}
              </button>
              {notesMessage && <p className="text-sm text-green-700">{notesMessage}</p>}
              {!notesMessage && (
                <p className="text-xs text-text-secondary">
                  {hasUnsavedNotes ? 'You have unsaved note changes.' : 'Notes are up to date.'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
            {visit.notes?.trim() ? visit.notes : 'No visit notes recorded.'}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary font-heading">Tasks</h3>
            <p className="text-sm text-text-secondary">
              {tasks.length > 0
                ? 'Track the care steps completed during this visit.'
                : 'No tasks were attached to this visit.'}
            </p>
          </div>
        </div>

        {tasks.length > 0 ? (
          <ul className="space-y-3">
            {tasks.map((task) => {
              const isTaskBusy = isUpdatingTask && activeTaskId === task.id
              return (
                <li key={task.id} className="rounded-2xl border border-base-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-medium text-text-primary">{task.taskName}</p>
                        <StatusChip status={task.isCompleted ? 'completed' : 'scheduled'} />
                      </div>
                      <p className="mt-2 text-sm text-text-secondary">
                        {task.description || 'No task description'}
                      </p>
                      {task.notes && (
                        <p className="mt-2 text-sm text-text-secondary">Notes: {task.notes}</p>
                      )}
                      {task.completedAt && (
                        <p className="mt-2 text-xs text-text-secondary">
                          Completed {formatDateTime(task.completedAt)}
                        </p>
                      )}
                    </div>

                    {canEdit ? (
                      <button
                        type="button"
                        className={buttonVariants({
                          variant: task.isCompleted ? 'outline' : 'secondary',
                          size: 'sm',
                          className: 'self-start',
                        })}
                        onClick={() => toggleTask(task)}
                        disabled={isTaskBusy}
                      >
                        {isTaskBusy ? 'Updating…' : task.isCompleted ? 'Reopen task' : 'Complete task'}
                      </button>
                    ) : (
                      <span className="text-sm text-text-secondary">Read only</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-text-secondary">
            No tasks were attached to this visit.
          </div>
        )}
      </section>

      {error && (
        <p className={cn('text-sm text-red-600')} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
