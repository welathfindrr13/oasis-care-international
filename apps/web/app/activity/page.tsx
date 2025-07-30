'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

type Stats = { booked: number; finished: number };

export default function ActivityPage() {
  const { data, error } = useSWR<Stats>('/stats/today', fetcher, {
    refreshInterval: 30_000, // 30 seconds
  });

  if (error) {
    return (
      <main className="flex flex-col items-center gap-8 p-10">
        <h1 className="text-3xl font-semibold">Today&apos;s Activity</h1>
        <div className="rounded-lg bg-red-100 p-6 text-red-800">
          <p className="text-lg">Error loading stats. Please ensure you&apos;re logged in as an admin.</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex flex-col items-center gap-8 p-10">
        <h1 className="text-3xl font-semibold">Today&apos;s Activity</h1>
        <p className="text-lg text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center gap-8 p-10">
      <h1 className="text-3xl font-semibold">Today&apos;s Activity</h1>
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <StatCard label="Visits booked today" value={data.booked} />
        <StatCard label="Visits finished today" value={data.finished} />
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-100 p-8 text-center shadow-md min-w-[200px]">
      <div className="text-5xl font-bold text-gray-800">{value}</div>
      <div className="mt-2 text-gray-600">{label}</div>
    </div>
  );
}
