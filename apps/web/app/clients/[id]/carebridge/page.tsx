import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "../../../../components/oasis/Header";
import { Alert } from "../../../../components/ui/Alert";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { StatePanel } from "../../../../components/ui/StatePanel";
import { query } from "../../../../lib/graphql/client";
import {
  CAREBRIDGE_ROOMS_QUERY,
  CLIENT_QUERY,
  FAMILY_UPDATE_COMPLETED_VISITS_QUERY,
  VERIFIED_VISIT_STORIES_QUERY,
  type CareRoomsQueryResponse,
  type ClientQueryResponse,
  type FamilyUpdateCompletedVisitsQueryResponse,
  type VerifiedVisitStoriesQueryResponse,
} from "../../../../lib/graphql/queries";
import { VerifiedVisitStoryCard } from "../../../../components/carebridge/VerifiedVisitStoryCard";
import { FamilyAccessManagerClient } from "./FamilyAccessManagerClient";
import { FamilyUpdateDraftClient } from "./FamilyUpdateDraftClient";
import {
  FAMILY_UPDATE_VISIT_PAGE_SIZE,
  activePreparedVisitIds,
  completedVisitPageDetails,
  parseCompletedVisitPage,
} from "../../../../lib/family-update-eligibility";

export const dynamic = "force-dynamic";

async function loadPerson(clientId: string) {
  try {
    const data = await query<ClientQueryResponse>(CLIENT_QUERY, {
      id: clientId,
    });
    return { person: data.client, unavailable: false };
  } catch {
    return { person: null, unavailable: true };
  }
}

async function loadRoom(clientId: string) {
  try {
    const data = await query<CareRoomsQueryResponse>(CAREBRIDGE_ROOMS_QUERY);
    return {
      room: data.careRooms.find((room) => room.client.id === clientId) ?? null,
      unavailable: false,
    };
  } catch {
    return { room: null, unavailable: true };
  }
}

async function loadStories(careRoomId: string) {
  try {
    const data = await query<VerifiedVisitStoriesQueryResponse>(
      VERIFIED_VISIT_STORIES_QUERY,
      { careRoomId },
    );
    return { stories: data.verifiedVisitStories, unavailable: false };
  } catch {
    return { stories: [], unavailable: true };
  }
}

async function loadCompletedVisits(
  clientId: string,
  skip: number,
  take = FAMILY_UPDATE_VISIT_PAGE_SIZE,
) {
  try {
    const data = await query<FamilyUpdateCompletedVisitsQueryResponse>(
      FAMILY_UPDATE_COMPLETED_VISITS_QUERY,
      { clientId, skip, take },
    );
    return {
      visits: data.visits.items,
      total: data.visits.total,
      unavailable: false,
    };
  } catch {
    return {
      visits: [] as FamilyUpdateCompletedVisitsQueryResponse["visits"]["items"],
      total: 0,
      unavailable: true,
    };
  }
}

function completedVisitPageHref(clientId: string, page: number) {
  const query = page > 1 ? `?completedVisitPage=${page}` : "";
  return `/clients/${encodeURIComponent(clientId)}/carebridge${query}`;
}

export default async function ClientCareBridgePage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    completedVisitPage?: string | string[];
  }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const requestedVisitPage = parseCompletedVisitPage(
    searchParams.completedVisitPage,
  );
  const [{ person, unavailable: personUnavailable }, roomResult] =
    await Promise.all([loadPerson(params.id), loadRoom(params.id)]);

  if (!person) {
    return (
      <div className="min-h-screen bg-oasis-canvas">
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <Card className="text-center">
            <h1 className="font-heading text-2xl font-semibold text-oasis-ink">
              {personUnavailable
                ? "Person details temporarily unavailable"
                : "Person not found"}
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
    );
  }

  const storyResult = roomResult.room
    ? await loadStories(roomResult.room.id)
    : { stories: [], unavailable: false };
  let visitResult = {
    visits: [] as FamilyUpdateCompletedVisitsQueryResponse["visits"]["items"],
    total: 0,
    unavailable: false,
  };
  let qualifiedVisitPage = completedVisitPageDetails(
    requestedVisitPage,
    0,
  );
  if (roomResult.room) {
    if (requestedVisitPage > 1) {
      const qualification = await loadCompletedVisits(params.id, 0, 1);
      if (qualification.unavailable) {
        visitResult = qualification;
      } else {
        qualifiedVisitPage = completedVisitPageDetails(
          requestedVisitPage,
          qualification.total,
        );
        if (qualifiedVisitPage.currentPage !== requestedVisitPage) {
          redirect(
            completedVisitPageHref(
              params.id,
              qualifiedVisitPage.currentPage,
            ),
          );
        }
        visitResult = await loadCompletedVisits(
          params.id,
          qualifiedVisitPage.skip,
        );
      }
    } else {
      visitResult = await loadCompletedVisits(params.id, 0);
    }
  }
  const visitPage = completedVisitPageDetails(
    requestedVisitPage,
    visitResult.total,
  );
  if (
    roomResult.room &&
    !visitResult.unavailable &&
    visitPage.currentPage !== requestedVisitPage
  ) {
    redirect(completedVisitPageHref(params.id, visitPage.currentPage));
  }
  const alreadyPrepared = activePreparedVisitIds(storyResult.stories);
  const eligibleVisits = visitResult.visits.filter(
    (visit) => !alreadyPrepared.has(visit.id),
  );

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
          <>
            <section
              className="mt-10 border-t border-oasis-border pt-8"
              aria-labelledby="prepare-family-update"
            >
              <h2
                id="prepare-family-update"
                className="font-heading text-2xl font-semibold text-oasis-ink"
              >
                Prepare a Family update
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-oasis-muted">
                Choose a completed visit for this client. Oasis will prepare a
                family-safe preview for review before anything is shared.
              </p>
              {visitResult.unavailable || storyResult.unavailable ? (
                <StatePanel
                  className="mt-4"
                  headingLevel={3}
                  kind="unavailable"
                  title="Completed visits are unavailable"
                  action={
                    <form
                      action={`/clients/${params.id}/carebridge`}
                      method="get"
                    >
                      {visitPage.currentPage > 1 ? (
                        <input
                          type="hidden"
                          name="completedVisitPage"
                          value={visitPage.currentPage}
                        />
                      ) : null}
                      <Button type="submit">Try again</Button>
                    </form>
                  }
                >
                  We could not confirm which visits are ready. Try again before
                  preparing an update.
                </StatePanel>
              ) : eligibleVisits.length === 0 ? (
                <StatePanel
                  className="mt-4"
                  headingLevel={3}
                  title={
                    visitResult.visits.length > 0
                      ? visitPage.totalPages > 1
                        ? "No visits on this page need an update"
                        : "All completed visits already have an update"
                      : "No completed visits are ready"
                  }
                >
                  {visitResult.visits.length > 0
                    ? visitPage.totalPages > 1
                      ? "Use the completed-visit pages to check earlier or later visits."
                      : "Review existing updates below or open the approval queue."
                    : "Complete a visit for this client before preparing a Family update."}
                </StatePanel>
              ) : (
                <FamilyUpdateDraftClient
                  careRoomId={roomResult.room.id}
                  completedVisits={eligibleVisits}
                />
              )}
              {!visitResult.unavailable && visitResult.total > 0 ? (
                <div className="mt-6 border-t border-oasis-border pt-4">
                  <p
                    className="text-sm text-oasis-muted"
                    aria-live="polite"
                  >
                    Showing completed visits {visitPage.firstItem}–
                    {visitPage.lastItem} of {visitResult.total}. Page{" "}
                    {visitPage.currentPage} of {visitPage.totalPages}.
                  </p>
                  {visitPage.totalPages > 1 ? (
                    <nav
                      className="mt-3 flex flex-wrap gap-3"
                      aria-label="Completed visit pages"
                    >
                      {visitPage.hasPrevious ? (
                        <Button asChild variant="secondary">
                          <Link
                            href={completedVisitPageHref(
                              params.id,
                              visitPage.currentPage - 1,
                            )}
                            rel="prev"
                          >
                            Previous completed visits
                          </Link>
                        </Button>
                      ) : null}
                      {visitPage.hasNext ? (
                        <Button asChild variant="secondary">
                          <Link
                            href={completedVisitPageHref(
                              params.id,
                              visitPage.currentPage + 1,
                            )}
                            rel="next"
                          >
                            Next completed visits
                          </Link>
                        </Button>
                      ) : null}
                    </nav>
                  ) : null}
                </div>
              ) : null}
            </section>

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
          </>
        ) : null}
      </main>
    </div>
  );
}
