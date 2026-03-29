'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { StatusChip } from '../../../components/oasis/StatusChip'
import { buttonVariants } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  UPDATE_VISIT_MUTATION,
  UPDATE_VISIT_TASK_MUTATION,
  type UpdateVisitMutationResponse,
  type UpdateVisitTaskMutationResponse,
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
  const [visitUpdatedAt, setVisitUpdatedAt] = useState(visit.updatedAt)
  const [tasks, setTasks] = useState(visit.tasks)
  const [taskNoteDrafts, setTaskNoteDrafts] = useState<Record<string, string>>(
    Object.fromEntries(visit.tasks.map((task) => [task.id, task.notes ?? '']))
  )
  const [error, setError] = useState<string | null>(null)
  const [notesMessage, setNotesMessage] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [isSavingNotes, startSavingNotes] = useTransition()
  const [isUpdatingTask, startUpdatingTask] = useTransition()
  const completedTasks = tasks.filter((task) => task.isCompleted).length
  const totalTasks = tasks.length

  const hasUnsavedNotes = notesDraft !== savedNotes
  const hasUnsavedTaskNotes = (taskId: string) =>
    (taskNoteDrafts[taskId] ?? '') !== (tasks.find((task) => task.id === taskId)?.notes ?? '')

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
        setVisitUpdatedAt(data.updateVisit.updatedAt)
        setNotesMessage('Visit notes saved.')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save visit notes')
      }
    })
  }

  const updateTask = (
    task: VisitTask | VisitCareLogPanelProps['visit']['tasks'][number],
    updates: { isCompleted?: boolean; notes?: string }
  ) => {
    setError(null)
    setNotesMessage(null)
    setActiveTaskId(task.id)

    startUpdatingTask(async () => {
      try {
        const data = await clientQuery<UpdateVisitTaskMutationResponse>(
          UPDATE_VISIT_TASK_MUTATION,
          {
            input: {
              id: task.id,
              isCompleted: updates.isCompleted,
              notes: updates.notes,
            },
          }
        )

        const updatedTask = data.updateVisitTask
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
        setTaskNoteDrafts((current) => ({
          ...current,
          [task.id]: updatedTask.notes ?? '',
        }))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update task')
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
        <p className="mt-3 text-xs text-text-secondary">
          Last updated {formatDateTime(visitUpdatedAt)}
        </p>
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
          {totalTasks > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-text-secondary">
              {completedTasks} / {totalTasks} complete
            </div>
          )}
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
                      {canEdit ? (
                        <div className="mt-3 space-y-2">
                          <label htmlFor={`task-notes-${task.id}`} className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                            Task notes
                          </label>
                          <textarea
                            id={`task-notes-${task.id}`}
                            value={taskNoteDrafts[task.id] ?? ''}
                            onChange={(event) =>
                              setTaskNoteDrafts((current) => ({
                                ...current,
                                [task.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-text-primary shadow-sm outline-none transition focus:border-brand-blue-primary focus:ring-2 focus:ring-brand-blue-primary/20"
                            placeholder="Capture any specific care detail for this task."
                          />
                        </div>
                      ) : task.notes ? (
                        <p className="mt-2 text-sm text-text-secondary">Notes: {task.notes}</p>
                      ) : (
                        <p className="mt-2 text-sm text-text-secondary">No task notes recorded.</p>
                      )}
                      {task.completedAt && (
                        <p className="mt-2 text-xs text-text-secondary">
                          Completed {formatDateTime(task.completedAt)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-text-secondary">
                        Last updated {formatDateTime(task.updatedAt)}
                      </p>
                    </div>

                    {canEdit ? (
                      <div className="flex flex-col gap-2 sm:items-end">
                        <button
                          type="button"
                          className={buttonVariants({
                            variant: task.isCompleted ? 'outline' : 'secondary',
                            size: 'sm',
                            className: 'self-start',
                          })}
                          onClick={() =>
                            updateTask(task, {
                              isCompleted: !task.isCompleted,
                              notes: taskNoteDrafts[task.id] ?? '',
                            })
                          }
                          disabled={isTaskBusy}
                        >
                          {isTaskBusy ? 'Updating…' : task.isCompleted ? 'Reopen task' : 'Complete task'}
                        </button>
                        <button
                          type="button"
                          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'self-start' })}
                          onClick={() =>
                            updateTask(task, {
                              isCompleted: task.isCompleted,
                              notes: taskNoteDrafts[task.id] ?? '',
                            })
                          }
                          disabled={isTaskBusy || !hasUnsavedTaskNotes(task.id)}
                        >
                          Save task notes
                        </button>
                        {!hasUnsavedTaskNotes(task.id) && (
                          <span className="text-xs text-text-secondary">
                            Task notes are up to date.
                          </span>
                        )}
                      </div>
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
