import Link from 'next/link'
import { Header } from '../../../../components/oasis/Header'
import { VerifiedVisitStoryCard } from '../../../../components/carebridge/VerifiedVisitStoryCard'
import { query } from '../../../../lib/graphql/client'
import {
  CAREBRIDGE_ROOM_QUERY,
  VERIFIED_VISIT_STORIES_QUERY,
  type CareRoomQueryResponse,
  type CarebridgeRoom,
  type VerifiedVisitStoriesQueryResponse,
  type VerifiedVisitStory,
} from '../../../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

function isFamilyVisibleStory(story: VerifiedVisitStory): boolean {
  const normalized = (story.status || '').toUpperCase()
  return normalized === 'PUBLISHED'
}

async function getRoomSafe(id: string): Promise<{ room: CarebridgeRoom | null; error: string | null }> {
  try {
    const data = await query<CareRoomQueryResponse>(CAREBRIDGE_ROOM_QUERY, { id })
    return { room: data.careRoom, error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { room: null, error: message }
  }
}

async function getRoomStoriesSafe(careRoomId: string): Promise<VerifiedVisitStory[]> {
  try {
    const data = await query<VerifiedVisitStoriesQueryResponse>(VERIFIED_VISIT_STORIES_QUERY, {
      careRoomId,
    })
    return (data.verifiedVisitStories || []).filter(isFamilyVisibleStory)
  } catch {
    return []
  }
}

export default async function FamilyCareRoomPage({ params }: { params: { id: string } }) {
  const roomResult = await getRoomSafe(params.id)

  if (!roomResult.room) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="font-heading text-2xl font-semibold text-slate-900">Room unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">
              {roomResult.error || 'This room is not available with your current family access.'}
            </p>
            <Link
              href="/family"
              className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to family home
            </Link>
          </section>
        </main>
      </div>
    )
  }

  const room = roomResult.room
  const stories = await getRoomStoriesSafe(room.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <nav className="mb-6 text-sm">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/family" className="text-slate-500 hover:text-slate-700">
                Family home
              </Link>
            </li>
            <li className="text-slate-400">/</li>
            <li className="font-medium text-slate-900">{room.client.fullName}</li>
          </ol>
        </nav>

        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-cyan-50 p-8 shadow-sm">
          <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Family Assurance Room
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">{room.client.fullName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            You are seeing approved proof-of-care updates only. Internal notes and operational records stay inside the
            care team workflow.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-slate-900">What this page includes</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Approved updates prepared by your care team.</li>
            <li>Clear language about what happened and what changed.</li>
            <li>No raw operational logs or internal handover wording.</li>
          </ul>
        </section>

        <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Approved updates</h2>
            <p className="text-sm text-slate-500">{stories.length} updates</p>
          </div>

          {stories.length === 0 ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                No approved updates are available yet. When your care team publishes them, they will appear here.
              </p>
            </article>
          ) : (
            stories.map((story) => (
              <VerifiedVisitStoryCard key={story.id} story={story} audience="family" />
            ))
          )}
        </section>
      </main>
    </div>
  )
}
