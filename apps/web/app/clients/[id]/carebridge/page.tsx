import Link from 'next/link'
import { Header } from '../../../../components/oasis/Header'
import { Alert } from '../../../../components/ui/Alert'
import { Button } from '../../../../components/ui/Button'
import { Card } from '../../../../components/ui/Card'
import { query } from '../../../../lib/graphql/client'
import {
  CAREBRIDGE_ROOMS_QUERY,
  CLIENT_QUERY,
  VERIFIED_VISIT_STORIES_QUERY,
  type CareRoomsQueryResponse,
  type ClientQueryResponse,
  type VerifiedVisitStoriesQueryResponse,
} from '../../../../lib/graphql/queries'
import { VerifiedVisitStoryCard } from '../../../../components/carebridge/VerifiedVisitStoryCard'
import { FamilyAccessManagerClient } from './FamilyAccessManagerClient'

export const dynamic = 'force-dynamic'

async function loadPerson(clientId: string) {
  try {
    const data = await query<ClientQueryResponse>(CLIENT_QUERY, {
      id: clientId,
    })
    return { person: data.client, unavailable: false }
  } catch {
    return { person: null, unavailable: true }
  }
}

async function loadRoom(clientId: string) {
  try {
    const data = await query<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY)
    return {
      room: data.careRooms.find((room) => room.client.id === clientId) ?? null,
      unavailable: false,
    }
  } catch {
    return { room: null, unavailable: true }
  }
}

async function loadStories(careRoomId: string) {
  try {
    const data = await query<VerifiedVisitStoriesQueryResponse>(
      VERIFIED_VISIT_STORIES_QUERY,
      { careRoomId },
    )
    return { stories: data.verifiedVisitStories, unavailable: false }
  } catch {
    return { stories: [], unavailable: true }
  }
}

export default async function ClientCareBridgePage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const [{ person, unavailable: personUnavailable }, roomResult] =
    await Promise.all([loadPerson(params.id), loadRoom(params.id)])

  if (!person) {
    return (
      <div className="min-h-screen bg-oasis-canvas">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Card className="text-center">
            <h1 className="font-heading text-2xl font-semibold text-oasis-ink">
              {personUnavailable
                ? 'Person details temporarily unavailable'
                : 'Person not found'}
            </h1>
            <p className="mt-2 text-sm text-oasis-muted">
              Try again or return to the people list.
            </p>
            <Button asChild className="mt-4" variant="secondary">
              <Link href="/people">Back to people</Link>
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  const storyResult = roomResult.room
    ? await loadStories(roomResult.room.id)
    : { stories: [], unavailable: false }

  return (
    <div className="min-h-screen bg-oasis-canvas">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-6 text-sm" aria-label="Breadcrumb">
          <Link
            href={`/people/${params.id}`}
            className="text-oasis-muted underline-offset-4 hover:underline"
          >
            Back to {person.fullName}
          </Link>
        </nav>

        <header className="border-b border-oasis-border pb-6">
          <p className="text-sm font-semibold text-oasis-teal">Family access</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-oasis-ink">
            Family access for {person.fullName}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-oasis-muted">
            Invite family from this person’s record and choose exactly which
            approved information they can access.
          </p>
        </header>

        {roomResult.unavailable ? (
          <Alert
            className="mt-6"
            live
            tone="danger"
            title="Family access unavailable"
          >
            We could not load the current family-access status. Try again before
            making changes.
          </Alert>
        ) : (
          <div className="mt-6">
            <FamilyAccessManagerClient
              clientId={params.id}
              initialRoom={roomResult.room}
              personName={person.fullName}
            />
          </div>
        )}

        {roomResult.room ? (
          <section
            className="mt-10 border-t border-oasis-border pt-8"
            aria-labelledby="approved-update-preview"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="approved-update-preview"
                  className="font-heading text-2xl font-semibold text-oasis-ink"
                >
                  Approved-update preview
                </h2>
                <p className="mt-2 text-sm text-oasis-muted">
                  Review care updates before deciding what family members can
                  see.
                </p>
              </div>
              <Button asChild variant="secondary">
                <Link href="/carebridge/approvals">Open approval queue</Link>
              </Button>
            </div>
            {storyResult.unavailable ? (
              <Alert className="mt-4" tone="attention">
                Updates are temporarily unavailable.
              </Alert>
            ) : storyResult.stories.length === 0 ? (
              <Card className="mt-4">
                <p className="text-sm text-oasis-muted">
                  No care updates have been prepared for family sharing yet.
                </p>
              </Card>
            ) : (
              <div className="mt-4 space-y-4">
                {storyResult.stories.map((story) => (
                  <VerifiedVisitStoryCard key={story.id} story={story} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
