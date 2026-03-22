'use client';

import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Header } from '../../components/oasis/Header';

type Stats = { booked: number; finished: number };
const statsFetcher = async (url: string): Promise<Stats> => {
  const response = await fetch(url, { credentials: 'include' });

  if (!response.ok) {
    throw new Error('Failed to load activity stats');
  }

  return response.json();
};

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const { data, error } = useSWR<Stats>('/api/stats/today', statsFetcher, {
    refreshInterval: 30_000, // 30 seconds
  });
  const showUnauthorizedMessage = searchParams.get('unauthorized') === '1';

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              Today&apos;s Activity
            </h1>
            <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-6">
            <p className="text-lg text-red-800">Error loading stats. Please ensure you&apos;re logged in as an admin.</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              Today&apos;s Activity
            </h1>
            <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-lg text-slate-600">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Today&apos;s Activity
          </h1>
          <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
        </div>
        {showUnauthorizedMessage && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            That page is only available to admin users. You&apos;re still signed in, and we&apos;ve brought you back to your activity view.
          </div>
        )}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Visits booked today" value={data.booked} icon="📅" />
          <StatCard label="Visits finished today" value={data.finished} icon="✅" />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-2xl">
          {icon}
        </div>
      </div>
    </div>
  );
}
