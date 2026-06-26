'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '../../../components/oasis/Header'
import { Button } from '../../../components/ui/Button'
import { useClerkClientQuery } from '../../../lib/graphql/useClerkClientQuery'
import {
  CAREBRIDGE_CONCERN_INBOX_QUERY,
  UPDATE_CAREBRIDGE_CONCERN_MUTATION,
  type CarebridgeConcern,
  type CarebridgeConcernInboxQueryResponse,
} from '../../../lib/graphql/queries'
import { ConcernInboxList } from '../../../components/carebridge/ConcernInboxList'

export function CareBridgeConcernsClient() {
  const [concerns, setConcerns] = useState<CarebridgeConcern[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busyConcernId, setBusyConcernId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryWithClerkToken = useClerkClientQuery()

  const loadConcerns = useCallback(async (status?: string) => {
    const data = await queryWithClerkToken<CarebridgeConcernInboxQueryResponse>(
      CAREBRIDGE_CONCERN_INBOX_QUERY,
      status ? { status } : {},
    )
    setConcerns(data.carebridgeConcernInbox)
  }, [queryWithClerkToken])

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true)
        setError(null)
        await loadConcerns(statusFilter || undefined)
      } catch (err: any) {
        setError(err?.message || 'Failed to load the concern inbox.')
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [loadConcerns, statusFilter])

  async function acknowledgeConcern(concernId: string) {
    try {
      setBusyConcernId(concernId)
      setError(null)
      await queryWithClerkToken(UPDATE_CAREBRIDGE_CONCERN_MUTATION, {
        input: {
          concernId,
          status: 'ACKNOWLEDGED',
        },
      })
      await loadConcerns(statusFilter || undefined)
    } catch (err: any) {
      setError(err?.message || 'Unable to acknowledge this concern.')
    } finally {
      setBusyConcernId(null)
    }
  }

  async function resolveConcern(concernId: string, resolutionNote: string) {
    try {
      setBusyConcernId(concernId)
      setError(null)
      await queryWithClerkToken(UPDATE_CAREBRIDGE_CONCERN_MUTATION, {
        input: {
          concernId,
          status: 'RESOLVED',
          outcome: 'RESOLVED',
          message: resolutionNote,
        },
      })
      await loadConcerns(statusFilter || undefined)
    } catch (err: any) {
      setError(err?.message || 'Unable to resolve this concern.')
    } finally {
      setBusyConcernId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Concern inbox
              </p>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
                Work family concerns from one operational queue
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Every concern needs an owner, a clock, and a clear outcome. This inbox keeps the workflow visible instead of letting it disappear into calls or email threads.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Concerns shown</p>
              <p className="mt-2 font-heading text-3xl font-bold text-slate-900">{concerns.length}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-lg font-semibold text-slate-900">Filter concern status</h2>
              <p className="mt-1 text-sm text-slate-600">Use this view to stay focused on open work first.</p>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </label>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
              Loading concern inbox...
            </div>
          ) : (
            <ConcernInboxList
              concerns={concerns}
              busyConcernId={busyConcernId}
              onAcknowledge={acknowledgeConcern}
              onResolve={resolveConcern}
            />
          )}
        </section>

        <section className="mt-6 flex gap-3">
          <Button asChild variant="outline">
            <Link href="/family-updates">Back to Family Updates</Link>
          </Button>
        </section>
      </main>
    </div>
  )
}
