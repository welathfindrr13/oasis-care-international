'use client'

import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Header } from '../../components/oasis/Header'

type Stats = { booked: number; finished: number }

const statsFetcher = async (url: string): Promise<Stats> => {
  const response = await fetch(url, { credentials: 'include' })

  if (!response.ok) {
    throw new Error('Failed to load activity stats')
  }

  return response.json()
}

export default function ActivityPage() {
  const searchParams = useSearchParams()
  const { data, error } = useSWR<Stats>('/api/stats/today', statsFetcher, {
    refreshInterval: 30_000,
  })
  const showUnauthorizedMessage = searchParams.get('unauthorized') === '1'

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Activity</h1>
            <p className="mt-1 text-slate-500">Today&apos;s real visit totals for the current signed-in role</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <p className="text-lg text-red-800">Error loading today&apos;s activity totals.</p>
          </div>
        </main>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Activity</h1>
            <p className="mt-1 text-slate-500">Today&apos;s real visit totals for the current signed-in role</p>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-lg text-slate-600">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Activity</h1>
          <p className="mt-1 text-slate-500">Today&apos;s real visit totals for the current signed-in role</p>
        </div>

        {showUnauthorizedMessage && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Detailed admin-only pages still stay protected. This activity page shows the real visit totals your role is
            allowed to see.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Visits scheduled today" value={data.booked} icon="📅" />
          <StatCard label="Visits finished today" value={data.finished} icon="✅" />
          <StatCard
            label="Remaining today"
            value={Math.max(data.booked - data.finished, 0)}
            icon="🕒"
          />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-lg font-semibold text-slate-900">What&apos;s on this page</h2>
          <p className="mt-2 text-sm text-slate-600">
            This page exposes the real visit totals behind today&apos;s workload. A detailed event-by-event activity feed
            is not wired here yet, so Oasis stays explicit about that instead of showing fake activity items.
          </p>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-2xl">{icon}</div>
      </div>
    </div>
  )
}
