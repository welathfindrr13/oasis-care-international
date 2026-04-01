'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { Header } from '../../components/oasis/Header'
import { buttonVariants } from '../../components/ui/Button'

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
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Totals</h1>
            <p className="mt-1 text-slate-500">Live visit throughput for the current signed-in role.</p>
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
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Totals</h1>
            <p className="mt-1 text-slate-500">Live visit throughput for the current signed-in role.</p>
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Today&apos;s Totals</h1>
              <p className="mt-1 text-slate-500">Live visit throughput for the current signed-in role.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/visits" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Open visits
              </Link>
              <Link href="/emar" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Open eMAR
              </Link>
            </div>
          </div>
        </div>

        {showUnauthorizedMessage && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Admin-only routes stay protected. This page only shows the totals your role is allowed to see.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Visits scheduled today" value={data.booked} />
          <StatCard label="Visits finished today" value={data.finished} />
          <StatCard label="Remaining today" value={Math.max(data.booked - data.finished, 0)} />
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Next actions</h2>
          <p className="mt-2 text-sm text-slate-600">
            These totals refresh every 30 seconds. Move into visits or eMAR when you need the underlying operational detail.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/visits" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Open visits
            </Link>
            <Link href="/emar" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Open eMAR
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
