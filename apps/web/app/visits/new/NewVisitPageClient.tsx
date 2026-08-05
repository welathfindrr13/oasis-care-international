'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { useClientAccess } from '../../../components/providers/ClientAccessProvider'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  formatOrganizationDateTimeInput,
  organizationDateTimeInputToIso,
} from '../../../lib/time'
import {
  CARERS_QUERY,
  CLIENTS_QUERY,
  CREATE_VISIT_MUTATION,
  type CarersQueryResponse,
  type ClientsQueryResponse,
} from '../../../lib/graphql/queries'
import {
  MAX_VISIT_CARE_TASK_LABEL_LENGTH,
  MAX_VISIT_CARE_TASKS,
  isUncertainVisitSubmissionError,
  validateVisitCareTasks,
  type VisitCareTaskRow,
} from './careTasks'

const FORM_LOAD_TIMEOUT_MS = 12_000

interface FormState {
  clientId: string
  carerId: string
  startTime: string
  endTime: string
  notes: string
}

interface NewVisitPageClientProps {
  initialClientId: string
}

function toOrganizationDatetimeValue(date: Date) {
  return formatOrganizationDateTimeInput(date)
}

export default function NewVisitPageClient({ initialClientId }: NewVisitPageClientProps) {
  const router = useRouter()
  const { authenticated, getBearerToken, isAdmin, status } = useClientAccess()
  const [clients, setClients] = useState<ClientsQueryResponse['clients']['items']>([])
  const [carers, setCarers] = useState<CarersQueryResponse['carers']>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [careTasks, setCareTasks] = useState<VisitCareTaskRow[]>([])
  const [careTaskErrors, setCareTaskErrors] = useState<Record<string, string>>({})
  const [careTaskListError, setCareTaskListError] = useState<string | null>(null)
  const nextCareTaskId = useRef(0)
  const careTaskInputs = useRef(new Map<string, HTMLInputElement>())
  const careTaskErrorSummary = useRef<HTMLDivElement>(null)
  const submissionInFlight = useRef(false)

  const defaultStart = useMemo(() => {
    const date = new Date(Date.now() + 60 * 60_000)
    date.setUTCMinutes(0, 0, 0)
    return toOrganizationDatetimeValue(date)
  }, [])

  const defaultEnd = useMemo(() => {
    const date = new Date(Date.now() + 2 * 60 * 60_000)
    date.setUTCMinutes(0, 0, 0)
    return toOrganizationDatetimeValue(date)
  }, [])

  const [form, setForm] = useState<FormState>({
    clientId: initialClientId,
    carerId: '',
    startTime: defaultStart,
    endTime: defaultEnd,
    notes: '',
  })

  useEffect(() => {
    if (!initialClientId) return
    setForm((prev) => ({ ...prev, clientId: initialClientId }))
  }, [initialClientId])

  const normalizedError = (error || '').toLowerCase()
  const isUnauthorized =
    !!error && (error.includes('401') || normalizedError.includes('unauthorized'))
  const isForbidden =
    !!error && (error.includes('403') || normalizedError.includes('forbidden'))
  const isTimeout = !!error && normalizedError.includes('timed out')

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      if (status === 'loading') return

      setLoading(true)
      setError(null)

      if (!authenticated) {
        setError('Unauthorized')
        setLoading(false)
        return
      }

      if (!isAdmin) {
        setError('Forbidden')
        setLoading(false)
        return
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null

      try {
        const loadPromise = Promise.all([
          clientQuery<ClientsQueryResponse>(
            CLIENTS_QUERY,
            { take: 200, skip: 0 },
            { getBearerToken },
          ),
          clientQuery<CarersQueryResponse>(CARERS_QUERY, undefined, { getBearerToken }),
        ])

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Form load timed out after ${FORM_LOAD_TIMEOUT_MS}ms`))
          }, FORM_LOAD_TIMEOUT_MS)
        })

        const [clientsResult, carersResult] = (await Promise.race([
          loadPromise,
          timeoutPromise,
        ])) as [ClientsQueryResponse, CarersQueryResponse]

        if (cancelled) return
        setClients(clientsResult.clients.items)
        setCarers(carersResult.carers)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message || 'Failed to load form data')
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        if (cancelled) return
        setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [authenticated, getBearerToken, isAdmin, loadAttempt, status])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (submissionInFlight.current) return

    if (!authenticated || !isAdmin) {
      setError(authenticated ? 'Forbidden' : 'Unauthorized')
      return
    }

    const taskValidation = validateVisitCareTasks(careTasks)
    if (taskValidation.listError) {
      setCareTaskErrors(taskValidation.fieldErrors)
      setCareTaskListError(taskValidation.listError)
      const firstInvalidTask = careTasks.find(
        (task) => taskValidation.fieldErrors[task.id],
      )
      window.requestAnimationFrame(() => {
        if (firstInvalidTask) {
          careTaskInputs.current.get(firstInvalidTask.id)?.focus()
        } else {
          careTaskErrorSummary.current?.focus()
        }
      })
      return
    }

    submissionInFlight.current = true
    setIsSubmitting(true)
    setError(null)
    setCareTaskErrors({})
    setCareTaskListError(null)

    try {
      await clientQuery(
        CREATE_VISIT_MUTATION,
        {
          input: {
            clientId: form.clientId,
            carerId: form.carerId,
            scheduledStart: organizationDateTimeInputToIso(form.startTime),
            scheduledEnd: organizationDateTimeInputToIso(form.endTime),
            notes: form.notes || undefined,
            tasks:
              taskValidation.labels.length > 0
                ? taskValidation.labels.map((taskName) => ({ taskName }))
                : undefined,
          },
        },
        { getBearerToken },
      )
      router.push(`/schedule?clientId=${form.clientId}`)
    } catch (err: any) {
      setError(
        isUncertainVisitSubmissionError(err)
          ? 'We could not confirm whether the visit was scheduled. Check the Schedule before trying again.'
          : err?.message || 'Failed to schedule visit',
      )
    } finally {
      submissionInFlight.current = false
      setIsSubmitting(false)
    }
  }

  function addCareTask() {
    if (careTasks.length >= MAX_VISIT_CARE_TASKS) return
    nextCareTaskId.current += 1
    const id = `care-task-${nextCareTaskId.current}`
    setCareTasks((current) => [...current, { id, label: '' }])
    setCareTaskListError(null)
    window.requestAnimationFrame(() => careTaskInputs.current.get(id)?.focus())
  }

  function updateCareTask(id: string, label: string) {
    setCareTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, label } : task)),
    )
    setCareTaskErrors((current) => {
      if (!current[id]) return current
      const next = { ...current }
      delete next[id]
      return next
    })
    setCareTaskListError(null)
  }

  function removeCareTask(id: string) {
    setCareTasks((current) => current.filter((task) => task.id !== id))
    setCareTaskErrors((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    setCareTaskListError(null)
    careTaskInputs.current.delete(id)
  }

  if (isUnauthorized || isForbidden) {
    return (
      <div className="min-h-screen bg-background-secondary">
        <Header />
        <main className="max-w-3xl mx-auto p-6">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-text-primary font-heading">
                {isForbidden ? 'Admin access required' : 'Sign in required'}
              </h2>
              <p className="text-sm text-text-secondary">
                {isForbidden
                  ? 'Only administrators can schedule visits.'
                  : 'You need an authenticated session to load clients and carers.'}
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="primary">
                <Link href={isForbidden ? '/activity' : '/login'}>
                  {isForbidden ? 'Go to activity' : 'Go to login'}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const hasLoadFailure = !!error && clients.length === 0 && carers.length === 0
  const formReady = clients.length > 0 && carers.length > 0

  return (
    <div className="min-h-screen bg-background-secondary">
      <Header />
      <div className="max-w-7xl mx-auto p-6">

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-text-primary font-heading mb-2">
            Schedule New Visit
          </h1>
          <p className="text-text-secondary">Create a new care visit for a person supported</p>
        </div>

        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-text-primary font-heading">
                Visit Details
              </h2>
              <p className="text-sm text-text-secondary">
                Fill out the form below to schedule a new visit
              </p>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="mb-4 rounded-sm border border-base-gray-200 bg-base-white p-3 text-sm text-text-secondary">
                  Loading clients and carers...
                </div>
              )}

              {hasLoadFailure && (
                <div className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <p>
                    {isTimeout
                      ? 'Loading timed out while fetching clients and carers.'
                      : 'The form data could not be loaded right now.'}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="primary" size="sm" onClick={() => setLoadAttempt((prev) => prev + 1)}>
                      Retry
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/activity">Back to activity</Link>
                    </Button>
                  </div>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label
                    htmlFor="client"
                    className="block text-sm font-medium text-text-primary mb-2"
                  >
                    Person *
                  </label>
                  <select
                    id="client"
                    name="client"
                    required
                    value={form.clientId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, clientId: e.target.value }))
                    }
                    disabled={loading || !clients.length}
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">
                      {loading ? 'Loading people...' : 'Select a person...'}
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.fullName} - {client.addressLine1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="carer"
                    className="block text-sm font-medium text-text-primary mb-2"
                  >
                    Carer *
                  </label>
                  <select
                    id="carer"
                    name="carer"
                    required
                    value={form.carerId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, carerId: e.target.value }))
                    }
                    disabled={loading || !carers.length}
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">
                      {loading ? 'Loading carers...' : 'Select a carer...'}
                    </option>
                    {carers.map((carer) => (
                      <option key={carer.id} value={carer.id}>
                        {carer.firstName} {carer.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="startTime"
                      className="block text-sm font-medium text-text-primary mb-2"
                    >
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      id="startTime"
                      name="startTime"
                      required
                      value={form.startTime}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, startTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="endTime"
                      className="block text-sm font-medium text-text-primary mb-2"
                    >
                      End Time *
                    </label>
                    <input
                      type="datetime-local"
                      id="endTime"
                      name="endTime"
                      required
                      value={form.endTime}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, endTime: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-text-primary mb-2"
                  >
                    Visit Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any special instructions or notes for this visit..."
                    className="w-full px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <fieldset className="space-y-4 border-t border-base-gray-200 pt-6">
                  <legend className="text-lg font-semibold text-text-primary font-heading">
                    Care tasks (optional)
                  </legend>
                  <p id="care-tasks-help" className="text-sm text-text-secondary">
                    Add the tasks the Carer should record during this visit. Do not add
                    medication instructions here.
                  </p>

                  {careTaskListError && (
                    <div
                      ref={careTaskErrorSummary}
                      role="alert"
                      tabIndex={-1}
                      className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      <p className="font-semibold">{careTaskListError}</p>
                      {careTasks.find((task) => careTaskErrors[task.id]) && (
                        <button
                          type="button"
                          className="mt-1 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          onClick={() => {
                            const firstInvalidTask = careTasks.find(
                              (task) => careTaskErrors[task.id],
                            )
                            if (firstInvalidTask) {
                              careTaskInputs.current.get(firstInvalidTask.id)?.focus()
                            }
                          }}
                        >
                          Go to the first care task with an error
                        </button>
                      )}
                    </div>
                  )}

                  {careTasks.map((task, index) => {
                    const inputId = `care-task-label-${task.id}`
                    const errorId = `${inputId}-error`
                    return (
                      <div key={task.id} className="space-y-2">
                        <label
                          htmlFor={inputId}
                          className="block text-sm font-medium text-text-primary"
                        >
                          Care task {index + 1}
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <input
                            ref={(node) => {
                              if (node) careTaskInputs.current.set(task.id, node)
                              else careTaskInputs.current.delete(task.id)
                            }}
                            type="text"
                            id={inputId}
                            name="careTask"
                            value={task.label}
                            maxLength={MAX_VISIT_CARE_TASK_LABEL_LENGTH}
                            aria-describedby={
                              careTaskErrors[task.id]
                                ? `care-tasks-help ${errorId}`
                                : 'care-tasks-help'
                            }
                            aria-invalid={careTaskErrors[task.id] ? 'true' : undefined}
                            onChange={(event) => updateCareTask(task.id, event.target.value)}
                            className="min-h-11 w-full flex-1 px-3 py-2 border border-base-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeCareTask(task.id)}
                          >
                            Remove care task {index + 1}
                          </Button>
                        </div>
                        {careTaskErrors[task.id] && (
                          <p id={errorId} className="text-sm text-red-700">
                            {careTaskErrors[task.id]}
                          </p>
                        )}
                      </div>
                    )
                  })}

                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCareTask}
                      disabled={careTasks.length >= MAX_VISIT_CARE_TASKS}
                    >
                      Add another care task
                    </Button>
                    <p className="mt-2 text-sm text-text-secondary">
                      You can add up to {MAX_VISIT_CARE_TASKS} care tasks.
                    </p>
                  </div>
                </fieldset>

                {error && (
                  <div
                    role="alert"
                    className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-4 pt-4">
                  <Button asChild variant="ghost">
                    <Link href="/schedule">Cancel</Link>
                  </Button>
                  <Button type="submit" variant="primary" disabled={isSubmitting || loading || !formReady}>
                    {isSubmitting ? 'Scheduling...' : 'Schedule Visit'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
