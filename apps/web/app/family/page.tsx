import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { InstallAppPrompt } from '../../components/pwa/InstallAppPrompt'
import { query } from '../../lib/graphql/client'
import {
  FAMILY_CAREBRIDGE_ROOMS_QUERY,
  type FamilyCareRoomsQueryResponse,
} from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

async function getFamilyCareRoomsSafe() {
  try {
    const data = await query<FamilyCareRoomsQueryResponse>(FAMILY_CAREBRIDGE_ROOMS_QUERY)
    return { rooms: Array.isArray(data.familyCareRooms) ? data.familyCareRooms : [], unavailable: false }
  } catch {
    return { rooms: [], unavailable: true }
  }
}

export default async function FamilyPage() {
  const { rooms, unavailable } = await getFamilyCareRoomsSafe()

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
          <article id="care-rooms" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Your care rooms</h2>
            {unavailable ? (
              <div className="mt-3 text-sm leading-6 text-slate-600">
                <p>Your care rooms are temporarily unavailable. Please try again.</p>
                <Link href="/family" className="mt-2 inline-flex font-medium text-sky-700 hover:text-sky-800">
                  Try again
                </Link>
              </div>
            ) : rooms.length === 0 ? (
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
                      <span className="font-medium text-slate-900">{room.clientDisplayName}</span>
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Open updates</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside id="concerns-help" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Concerns and help</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You will see approved updates and concern progress when enabled. You will not see raw care records or
              internal staff handover notes.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              If you are worried about someone’s care, use the contact route agreed with their care provider. In an
              emergency, call 999.
            </p>
          </aside>
        </section>

        <section id="updates" className="mt-6 scroll-mt-24 border-l-4 border-teal-700 px-4 py-1">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Updates</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open a care room above to read its approved updates in date order. Drafts and internal care notes are never
            shown here.
          </p>
        </section>

        <div className="mt-6">
          <InstallAppPrompt />
        </div>
      </main>
    </div>
  )
}
