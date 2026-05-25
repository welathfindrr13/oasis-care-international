'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Header } from '../../components/oasis/Header';
import { Button } from '../../components/ui/Button';

type Stats = { booked: number; finished: number };

export default function ActivityPage() {
  const { data, error, mutate } = useSWR<Stats>('/api/activity/today', fetcher, {
    refreshInterval: 30_000, // 30 seconds
    errorRetryCount: 3,
    errorRetryInterval: 2_000,
    revalidateOnFocus: true,
  });
  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    if (data || error) {
      setShowSlowNotice(false);
      return;
    }

    const timer = setTimeout(() => setShowSlowNotice(true), 6_000);
    return () => clearTimeout(timer);
  }, [data, error]);

  const errorMessage = error instanceof Error ? error.message : 'Failed to load activity stats';
  const isUnauthorized = errorMessage.toLowerCase().includes('unauthorized');
  const isForbidden = errorMessage.toLowerCase().includes('forbidden');

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
                Today&apos;s Activity
              </h1>
              <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/shift">Shift Clock</Link>
            </Button>
          </div>
          <div className="rounded-lg bg-red-50 border border-red-200 p-6">
            <p className="text-lg text-red-800 mb-1">
              {isUnauthorized
                ? 'You are signed out.'
                : isForbidden
                ? 'You do not have access to this activity view.'
                : 'Error loading activity stats.'}
            </p>
            <p className="text-sm text-red-700">
              {isUnauthorized || isForbidden ? 'Sign in again to continue.' : errorMessage}
            </p>
            <div className="mt-4">
              {isUnauthorized || isForbidden ? (
                <Button asChild variant="primary" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => mutate()}>
                  Retry
                </Button>
              )}
            </div>
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
          <div className="mb-8 flex items-center justify-between gap-3">
            <div>
              <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
                Today&apos;s Activity
              </h1>
              <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/shift">Shift Clock</Link>
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-8">
            <div className="animate-pulse text-lg text-slate-600">Loading...</div>
            {showSlowNotice && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                This is taking longer than expected.
                <button
                  type="button"
                  className="ml-2 font-semibold underline"
                  onClick={() => mutate()}
                >
                  Retry now
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
              Today&apos;s Activity
            </h1>
            <p className="text-slate-500 mt-1">Real-time overview of care activities</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/shift">Shift Clock</Link>
          </Button>
        </div>
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
