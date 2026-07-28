import type { VerifiedVisitStory } from "./graphql/queries";

export const FAMILY_UPDATE_VISIT_PAGE_SIZE = 50;

const MAX_GRAPHQL_INT = 2_147_483_647;
const ACTIVE_PREPARED_STORY_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

export function activePreparedVisitIds(
  stories: Array<
    Pick<VerifiedVisitStory, "status" | "sourceRefs">
  >,
) {
  return new Set(
    stories.flatMap((story) => {
      if (
        !ACTIVE_PREPARED_STORY_STATUSES.has(
          String(story.status).trim().toUpperCase(),
        )
      ) {
        return [];
      }

      return (Array.isArray(story.sourceRefs) ? story.sourceRefs : [])
        .filter(
          (reference) =>
            reference.type === "Visit" && typeof reference.id === "string",
        )
        .map((reference) => String(reference.id));
    }),
  );
}

export function parseCompletedVisitPage(
  value: string | string[] | undefined,
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^[1-9]\d*$/.test(candidate)) return 1;

  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed)) return 1;

  const maximumPage =
    Math.floor(MAX_GRAPHQL_INT / FAMILY_UPDATE_VISIT_PAGE_SIZE) + 1;
  return Math.min(parsed, maximumPage);
}

export function completedVisitPageDetails(page: number, total: number) {
  const safeTotal = Number.isSafeInteger(total) && total > 0 ? total : 0;
  const totalPages = Math.max(
    1,
    Math.ceil(safeTotal / FAMILY_UPDATE_VISIT_PAGE_SIZE),
  );
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const skip = (currentPage - 1) * FAMILY_UPDATE_VISIT_PAGE_SIZE;

  return {
    currentPage,
    totalPages,
    skip,
    firstItem: safeTotal === 0 ? 0 : skip + 1,
    lastItem: Math.min(skip + FAMILY_UPDATE_VISIT_PAGE_SIZE, safeTotal),
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}
