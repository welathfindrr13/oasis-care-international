'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '../../../components/oasis/Header'
import { Card, CardContent, CardHeader } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { clientQuery } from '../../../lib/graphql/client-side'
import {
  CARERS_QUERY,
  CLIENTS_QUERY,
  CREATE_VISIT_MUTATION,
  type CarersQueryResponse,
  type ClientsQueryResponse,
} from '../../../lib/graphql/queries'

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

function toLocalDatetimeValue(date: Date) {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

export default function NewVisitPageClient({ initialClientId }: NewVisitPageClientProps) {
  const router = useRouter()
  const [clients, setClients] = useState<ClientsQueryResponse['clients']['items']>([])
  const [carers, setCarers] = useState<CarersQueryResponse['carers']>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  const defaultStart = useMemo(() => {
    const date = new Date()
    date.setMinutes(0, 0, 0)
    date.setHours(date.getHours() + 1)
    return toLocalDatetimeValue(date)
  }, [])

  const defaultEnd = useMemo(() => {
    const date = new Date()
    date.setMinutes(0, 0, 0)
    date.setHours(date.getHours() + 2)
    return toLocalDatetimeValue(date)
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
      setLoading(true)
      setError(null)

      let timeoutId: ReturnType<typeof setTimeout> | null = null

      try {
        const loadPromise = Promise.all([
          clientQuery<ClientsQueryResponse>(CLIENTS_QUERY, { take: 200, skip: 0 }),
          clientQuery<CarersQueryResponse>(CARERS_QUERY),
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
  }, [loadAttempt])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await clientQuery(CREATE_VISIT_MUTATION, {
        input: {
          clientId: form.clientId,
          carerId: form.carerId,
          scheduledStart: new Date(form.startTime).toISOString(),
          scheduledEnd: new Date(form.endTime).toISOString(),
          notes: form.notes || undefined,
        },
      })
      router.push(`/schedule?clientId=${form.clientId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to schedule visit')
    } finally {
      setIsSubmitting(false)
    }
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

                {error && (
                  <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
