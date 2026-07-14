import Link from 'next/link'
import { Header } from '../../../../components/oasis/Header'
import { Button } from '../../../../components/ui/Button'
import { query } from '../../../../lib/graphql/client'
import {
  CAREBRIDGE_ROOMS_QUERY,
  VERIFIED_VISIT_STORIES_QUERY,
  type CareRoomsQueryResponse,
  type VerifiedVisitStoriesQueryResponse,
} from '../../../../lib/graphql/queries'
import { VerifiedVisitStoryCard } from '../../../../components/carebridge/VerifiedVisitStoryCard'

export const dynamic = 'force-dynamic'

async function getCarebridgeRoomForClient(clientId: string) {
  const data = await query<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY)
  return data.careRooms.find((room) => room.client.id === clientId) ?? null
}

async function getVerifiedStories(careRoomId: string) {
  const data = await query<VerifiedVisitStoriesQueryResponse>(VERIFIED_VISIT_STORIES_QUERY, { careRoomId })
  return data.verifiedVisitStories
}

export default async function ClientCareBridgePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const room = await getCarebridgeRoomForClient(params.id)
  const stories = room ? await getVerifiedStories(room.id) : []

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-6 text-sm">
          <Link href={`/people/${params.id}`} className="text-slate-500 hover:text-slate-700">
            Back to person profile
          </Link>
        </nav>

        <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-8 shadow-sm">
          <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Family Updates
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
            Proof-of-care updates for this person
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Review the active Family Assurance room, family access position, and recent Verified Visit Updates without leaving the person context.
          </p>
        </section>

        {!room ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="font-heading text-2xl font-semibold text-slate-900">No Family Assurance room yet</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create a Family Assurance room before staff can approve family-safe proof-of-care updates for this person.
            </p>
            <div className="mt-5">
              <Button asChild variant="outline">
                <Link href="/family-updates">Back to Family Updates</Link>
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Room status</p>
                <p className="mt-3 text-sm font-medium text-slate-700">{room.status}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Family members linked</p>
                <p className="mt-3 font-heading text-3xl font-bold text-slate-900">{room.memberships.length}</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stories recorded</p>
                <p className="mt-3 font-heading text-3xl font-bold text-slate-900">{stories.length}</p>
              </article>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div>
                  <h2 className="font-heading text-2xl font-semibold text-slate-900">Recent verified visit stories</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Staff can use these approved or draft updates to understand what families will see.
                  </p>
                </div>
                {stories.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
                    No verified visit stories have been created for this room yet.
                  </div>
                ) : (
                  stories.map((story) => <VerifiedVisitStoryCard key={story.id} story={story} />)
                )}
              </div>

              <aside className="space-y-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-heading text-lg font-semibold text-slate-900">Family access</h3>
                  <div className="mt-4 space-y-3">
                    {room.memberships.length === 0 ? (
                      <p className="text-sm text-slate-600">No active family memberships yet.</p>
                    ) : (
                      room.memberships.map((membership) => (
                        <div key={membership.id} className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-sm font-medium text-slate-900">{membership.familyContact.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {membership.familyContact.relationship || membership.role} · {membership.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-heading text-lg font-semibold text-slate-900">Next action</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Use the approval queue to publish family-safe proof-of-care updates once the wording and source references are ready.
                  </p>
                  <div className="mt-4">
                    <Button asChild>
                      <Link href={`/carebridge/approvals`}>Open approval queue</Link>
                    </Button>
                  </div>
                </article>
              </aside>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
