import Link from 'next/link'
import { Header } from '../../components/oasis/Header'
import { InstallAppPrompt } from '../../components/pwa/InstallAppPrompt'
import { query } from '../../lib/graphql/client'
import {
  FAMILY_CAREBRIDGE_ROOMS_QUERY,
  FAMILY_VERIFIED_VISIT_STORIES_QUERY,
  type FamilyCareRoomsQueryResponse,
  type FamilyVerifiedVisitStoriesQueryResponse,
  type FamilyVerifiedVisitStory,
} from '../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

async function getFamilyCareRoomsSafe() {
  try {
    const data = await query<FamilyCareRoomsQueryResponse>(FAMILY_CAREBRIDGE_ROOMS_QUERY)
    const rooms = Array.isArray(data.familyCareRooms) ? data.familyCareRooms : []
    const withUpdates = await Promise.all(rooms.map(async (room) => {
      try {
        const result = await query<FamilyVerifiedVisitStoriesQueryResponse>(FAMILY_VERIFIED_VISIT_STORIES_QUERY, {
          careRoomId: room.id,
        })
        const updates = Array.isArray(result.familyVerifiedVisitStories)
          ? [...result.familyVerifiedVisitStories].sort(
              (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
            )
          : []
        return { ...room, latestUpdate: updates[0] ?? null, updatesUnavailable: false }
      } catch {
        return { ...room, latestUpdate: null, updatesUnavailable: true }
      }
    }))
    return { rooms: withUpdates, unavailable: false }
  } catch {
    return { rooms: [], unavailable: true }
  }
}

function latestUpdateAcrossRooms(
  rooms: Array<{ latestUpdate: FamilyVerifiedVisitStory | null }>,
): FamilyVerifiedVisitStory | null {
  return rooms
    .map((room) => room.latestUpdate)
    .filter((update): update is FamilyVerifiedVisitStory => Boolean(update))
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())[0] ?? null
}

export default async function FamilyPage() {
  const { rooms, unavailable } = await getFamilyCareRoomsSafe()
  const latestUpdate = latestUpdateAcrossRooms(rooms)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-8 shadow-sm">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              Family updates
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
              Stay up to date with their care
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Read clear updates shared by the care team, and tell them if you have a question or concern.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article id="care-rooms" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-semibold text-slate-900">People you receive updates about</h2>
            {unavailable ? (
              <div className="mt-3 text-sm leading-6 text-slate-600">
                <p>Your family updates are temporarily unavailable. Please try again.</p>
                <Link href="/family" className="mt-2 inline-flex font-medium text-sky-700 hover:text-sky-800">
                  Try again
                </Link>
              </div>
            ) : rooms.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                You do not have access to anyone’s updates yet. The care provider can invite you when updates are
                ready to share.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <article className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">{room.clientDisplayName}</h3>
                          {room.updatesUnavailable ? (
                            <p className="mt-2 text-sm text-slate-600">Updates are temporarily unavailable.</p>
                          ) : room.latestUpdate ? (
                            <>
                              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                Latest · {new Date(room.latestUpdate.publishedAt).toLocaleDateString('en-GB')}
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-800">{room.latestUpdate.title}</p>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{room.latestUpdate.body}</p>
                            </>
                          ) : (
                            <p className="mt-2 text-sm text-slate-600">No updates have been shared yet.</p>
                          )}
                        </div>
                        <Link
                          href={`/family/care-rooms/${room.id}`}
                          className="shrink-0 rounded-full border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View updates
                        </Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <aside id="concerns-help" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Concerns and help</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Choose a person above to send their care team a question or concern. If online concerns are not included
              in your access, use the contact details the care provider has given you.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              If you are worried about someone’s care, use the contact route agreed with their care provider. In an
              emergency, call 999.
            </p>
          </aside>
        </section>

        <section id="updates" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-slate-900">Latest update</h2>
          {unavailable ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">The latest update is temporarily unavailable.</p>
          ) : latestUpdate ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {new Date(latestUpdate.publishedAt).toLocaleDateString('en-GB')}
              </p>
              <h3 className="mt-1 font-semibold text-slate-900">{latestUpdate.title}</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{latestUpdate.body}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              No family updates have been shared yet. When the care team publishes one, it will appear here.
            </p>
          )}
        </section>

        <div className="mt-6">
          <InstallAppPrompt />
        </div>
      </main>
    </div>
  )
}
