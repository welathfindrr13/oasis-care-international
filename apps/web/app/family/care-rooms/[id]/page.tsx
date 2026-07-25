import Link from 'next/link'
import { Header } from '../../../../components/oasis/Header'
import { FamilyConcernForm } from '../../../../components/carebridge/FamilyConcernForm'
import { StatePanel } from '../../../../components/ui/StatePanel'
import {
  familyConcernEventLabel,
  familyConcernStatusLabel,
} from '../../../../lib/family-concern-status'
import { query } from '../../../../lib/graphql/client'
import { formatDate, formatDateTime } from '../../../../lib/time'
import {
  FAMILY_CAREBRIDGE_ROOM_QUERY,
  FAMILY_CARE_ROOM_CONCERNS_QUERY,
  FAMILY_VERIFIED_VISIT_STORIES_QUERY,
  type FamilyCareRoomConcern,
  type FamilyCareRoomConcernsQueryResponse,
  type FamilyCareRoomQueryResponse,
  type FamilyCarebridgeRoom,
  type FamilyVerifiedVisitStoriesQueryResponse,
  type FamilyVerifiedVisitStory,
} from '../../../../lib/graphql/queries'

export const dynamic = 'force-dynamic'

type RoomResult = {
  room: FamilyCarebridgeRoom | null
  error: string | null
  unavailable: boolean
}

type ConcernResult = {
  concerns: FamilyCareRoomConcern[]
  unavailable: boolean
  notGranted: boolean
}

async function getRoomSafe(id: string): Promise<RoomResult> {
  try {
    const data = await query<FamilyCareRoomQueryResponse>(FAMILY_CAREBRIDGE_ROOM_QUERY, { id })
    return { room: data.familyCareRoom, error: null, unavailable: false }
  } catch (error) {
    const accessDenied = error instanceof Error && error.message.includes(
      'You do not have access to this CareBridge room.',
    )
    return accessDenied
      ? {
          room: null,
          error: 'These updates are not available with your current family access.',
          unavailable: false,
        }
      : {
          room: null,
          error: 'These updates are temporarily unavailable. Please try again.',
          unavailable: true,
        }
  }
}

async function getRoomStoriesSafe(
  careRoomId: string,
): Promise<{
  stories: FamilyVerifiedVisitStory[]
  unavailable: boolean
  notGranted: boolean
}> {
  try {
    const data = await query<FamilyVerifiedVisitStoriesQueryResponse>(FAMILY_VERIFIED_VISIT_STORIES_QUERY, {
      careRoomId,
    })
    return { stories: data.familyVerifiedVisitStories || [], unavailable: false, notGranted: false }
  } catch (error) {
    const notGranted = error instanceof Error && error.message.includes(
      'You do not have access to this CareBridge room.',
    )
    return notGranted
      ? { stories: [], unavailable: false, notGranted: true }
      : { stories: [], unavailable: true, notGranted: false }
  }
}

async function getRoomConcernsSafe(careRoomId: string): Promise<ConcernResult> {
  try {
    const data = await query<FamilyCareRoomConcernsQueryResponse>(
      FAMILY_CARE_ROOM_CONCERNS_QUERY,
      { careRoomId },
    )
    return {
      concerns: data.familyCareRoomConcerns || [],
      unavailable: false,
      notGranted: false,
    }
  } catch (error) {
    const notGranted = error instanceof Error && error.message.includes(
      'You do not have access to this CareBridge room.',
    )
    return notGranted
      ? { concerns: [], unavailable: false, notGranted: true }
      : { concerns: [], unavailable: true, notGranted: false }
  }
}

export default async function FamilyCareRoomPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const roomResult = await getRoomSafe(params.id)

  if (!roomResult.room) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <h1 className="font-heading text-2xl font-semibold text-oasis-ink">Family updates</h1>
          <StatePanel
            className="mt-6"
            kind={roomResult.unavailable ? 'unavailable' : 'forbidden'}
            title={roomResult.unavailable ? 'Updates temporarily unavailable' : 'Updates unavailable'}
            action={
              <Link
                href={roomResult.unavailable ? `/family/care-rooms/${params.id}` : '/family'}
                className="inline-flex min-h-11 items-center rounded-md border border-oasis-border bg-white px-4 py-2 text-sm font-semibold text-oasis-ink hover:bg-base-gray-50"
              >
                {roomResult.unavailable ? 'Try again' : 'Back to family home'}
              </Link>
            }
          >
            <p>
              {roomResult.error || 'These updates are not available with your current family access.'}
            </p>
          </StatePanel>
        </main>
      </div>
    )
  }

  const room = roomResult.room
  const {
    stories,
    unavailable: storiesUnavailable,
    notGranted: storiesNotGranted,
  } = room.canViewApprovedUpdates
    ? await getRoomStoriesSafe(room.id)
    : { stories: [], unavailable: false, notGranted: true }
  const concernResult = room.canRaiseConcerns
    ? await getRoomConcernsSafe(room.id)
    : { concerns: [], unavailable: false, notGranted: true }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/family" className="text-slate-500 hover:text-slate-700">
                Family home
              </Link>
            </li>
            <li className="text-slate-400" aria-hidden="true">/</li>
            <li className="font-medium text-slate-900" aria-current="page">{room.clientDisplayName}</li>
          </ol>
        </nav>

        <section className="border-b border-oasis-border pb-6">
          <p className="text-sm font-semibold text-oasis-brand">Family updates</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">{room.clientDisplayName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Use the family access that the care provider has approved for you.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-slate-900">What you can see here</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {room.canViewApprovedUpdates ? <li>Approved care updates and task summaries.</li> : null}
            {room.canRaiseConcerns ? <li>Send a question or concern to the care team.</li> : null}
          </ul>
        </section>

        {room.canViewApprovedUpdates ? <section className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Approved updates</h2>
            {!storiesUnavailable && !storiesNotGranted ? (
              <p className="text-sm text-slate-500">{stories.length} updates</p>
            ) : null}
          </div>

          {storiesNotGranted ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                Approved updates are not included in your current family access. Contact your care provider if you
                think this should change.
              </p>
            </article>
          ) : storiesUnavailable ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">Approved updates are temporarily unavailable. Please try again.</p>
              <Link
                href={`/family/care-rooms/${room.id}`}
                className="mt-3 inline-flex font-medium text-sky-700 hover:text-sky-800"
              >
                Try again
              </Link>
            </article>
          ) : stories.length === 0 ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">
                No approved updates are available yet. When your care team publishes them, they will appear here.
              </p>
            </article>
          ) : (
            stories.map((story) => (
              <article
                key={`${story.publishedAt}:${story.title}`}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {formatDate(story.publishedAt)}
                </p>
                <h3 className="mt-2 font-heading text-lg font-semibold text-slate-900">{story.title}</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{story.body}</p>
              </article>
            ))
          )}
        </section> : null}

        <section id="concerns-help" className="mt-6 scroll-mt-24 rounded-md border border-oasis-border bg-white p-6">
          {room.canRaiseConcerns && !concernResult.notGranted ? (
            <>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Tell us about a concern</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Send a question or concern about {room.clientDisplayName} directly to the care team. This form is not
                monitored as an emergency service. If someone is in immediate danger, call 999.
              </p>
              <div className="mt-5">
                <FamilyConcernForm careRoomId={room.id} personName={room.clientDisplayName} />
              </div>
            </>
          ) : null}

          <div
            className={room.canRaiseConcerns && !concernResult.notGranted
              ? 'mt-8 border-t border-oasis-border pt-6'
              : ''}
            aria-live="polite"
          >
            <h2 className="font-heading text-xl font-semibold text-oasis-ink">Your concerns</h2>
            <p className="mt-2 text-sm leading-6 text-oasis-muted">
              Track concerns you sent from this family account.
            </p>
            {concernResult.notGranted ? (
              <StatePanel className="mt-4" kind="forbidden" title="Concern access is not available">
                <p>Contact the care provider if you think your family access should include concerns.</p>
              </StatePanel>
            ) : concernResult.unavailable ? (
              <StatePanel
                className="mt-4"
                kind="unavailable"
                title="Concern statuses are temporarily unavailable"
                action={
                  <Link
                    href={`/family/care-rooms/${room.id}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-oasis-border bg-white px-4 py-2 text-sm font-semibold text-oasis-ink hover:bg-base-gray-50"
                  >
                    Try again
                  </Link>
                }
              >
                <p>Your concern has not been changed. Reload this page to try again.</p>
              </StatePanel>
            ) : concernResult.concerns.length === 0 ? (
              <StatePanel className="mt-4" title="No concerns sent">
                <p>Concerns you send about {room.clientDisplayName} will appear here.</p>
              </StatePanel>
            ) : (
              <div className="mt-4 space-y-4">
                {concernResult.concerns.map((concern) => (
                  <article key={concern.id} className="rounded-md border border-oasis-border p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <h3 className="font-semibold text-oasis-ink">{concern.title}</h3>
                      <p className="text-sm font-semibold text-oasis-brand">
                        {familyConcernStatusLabel(concern.status)}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-oasis-muted">
                      Sent {formatDateTime(concern.submittedAt)}
                    </p>
                    <ol className="mt-4 border-l-2 border-oasis-border pl-4">
                      {concern.events.map((event) => (
                        <li key={`${event.eventType}:${event.createdAt}`} className="pb-3 last:pb-0">
                          <p className="text-sm font-medium text-oasis-ink">
                            {familyConcernEventLabel(event.eventType)}
                          </p>
                          <p className="text-sm text-oasis-muted">
                            {formatDateTime(event.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
