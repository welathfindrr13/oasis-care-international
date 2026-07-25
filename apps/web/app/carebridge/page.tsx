import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { StatePanel } from '../../components/ui/StatePanel'
import { query } from '../../lib/graphql/client'
import { CAREBRIDGE_ROOMS_QUERY, type CareRoomsQueryResponse } from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

async function getCareRoomsSafe() {
  try {
    const data = await query<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY)
    return {
      rooms: Array.isArray(data.careRooms) ? data.careRooms : [],
      unavailable: false,
    }
  } catch {
    return { rooms: [], unavailable: true }
  }
}

export default async function CareBridgePage() {
  const result = await getCareRoomsSafe()
  const rooms = result.rooms
  const firstRoom = rooms[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Staff workflow
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
              Review Family Updates before families see them
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Family Updates is not a generic portal. It is where staff approves Verified Visit Updates so reassurance
              stays calm, accurate, source-linked, and scoped to the right care room.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/carebridge/approvals"
                className="inline-flex items-center rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Open Review Queue
              </Link>
              <Link
                href="/carebridge/concerns"
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open Concern Cases
              </Link>
              {firstRoom ? (
                <Link
                  href={`/clients/${firstRoom.client.id}/carebridge`}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open {firstRoom.client.fullName}&apos;s room
                </Link>
              ) : (
                <Link
                  href="/clients"
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Review clients
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Verified Visit Updates</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Draft updates are reviewed and approved before publication.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Resolution Tracker</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Concern workflows remain auditable instead of getting lost in inboxes.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Evidence Trail</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Approval actions create a clear trust record over time.
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Active Family Assurance rooms</h2>
            {result.unavailable ? (
              <StatePanel
                kind="unavailable"
                title="Family rooms are unavailable"
                action={
                  <form action="/carebridge" method="get">
                    <button type="submit" className="rounded-md bg-oasis-teal px-4 py-2 text-sm font-semibold text-white">
                      Try again
                    </button>
                  </form>
                }
              >
                Family room data could not be loaded. This is not an empty room list.
              </StatePanel>
            ) : rooms.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                No care rooms found yet. Once a room is active, staff can review stories in client context from here.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rooms.slice(0, 6).map((room) => (
                  <li key={room.id}>
                    <Link
                      href={`/clients/${room.client.id}/carebridge`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-900">{room.client.fullName}</span>
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{room.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
            <h2 className="font-heading text-lg font-semibold">Workflow boundary</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Family users receive approved updates only. Raw operational notes remain in staff workflows and are never
              exposed directly.
            </p>
          </aside>
        </section>
      </main>
    </div>
  )
}
