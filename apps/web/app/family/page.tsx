import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { query } from '../../lib/graphql/client'
import { CAREBRIDGE_ROOMS_QUERY, type CareRoomsQueryResponse } from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

async function getFamilyCareRoomsSafe() {
  try {
    const data = await query<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY)
    return Array.isArray(data.careRooms) ? data.careRooms : []
  } catch {
    return []
  }
}

export default async function FamilyPage() {
  const rooms = await getFamilyCareRoomsSafe()

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Family Assurance Room
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
              Follow approved proof-of-care updates
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              This space shows approved updates only. Internal notes and operational jargon stay with the care team,
              while you receive clear, family-safe reassurance about what happened.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Your care rooms</h2>
            {rooms.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                You do not have an active care room yet. Your agency can invite you when updates are ready.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/family/care-rooms/${room.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{room.client.fullName}</span>
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Open updates</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">What is shared</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You will see approved updates and concern progress when enabled. You will not see raw care records or
              internal staff handover notes.
            </p>
          </aside>
        </section>
      </main>
    </div>
  )
}
