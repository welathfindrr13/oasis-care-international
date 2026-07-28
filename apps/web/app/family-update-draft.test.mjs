import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const queries = read("../lib/graphql/queries.ts");
const clientPage = read("./clients/[id]/carebridge/page.tsx");
const draftClient = read(
  "./clients/[id]/carebridge/FamilyUpdateDraftClient.tsx",
);
const accessManager = read(
  "./clients/[id]/carebridge/FamilyAccessManagerClient.tsx",
);
const approvalsPage = read("./carebridge/approvals/page.tsx");
const approvalsClient = read(
  "./carebridge/approvals/CareBridgeApprovalsClient.tsx",
);
const approvalItem = read("../components/carebridge/ApprovalQueueItem.tsx");
const eligibility = read("../lib/family-update-eligibility.ts");

function operation(name) {
  const start = queries.indexOf(`export const ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = queries.indexOf("\n`;", start);
  assert.notEqual(end, -1, `${name} must have a complete GraphQL document`);
  return queries.slice(start, end + 3);
}

test("Manager draft creation fetches only the completed-visit decision fields", () => {
  const completedVisits = operation("FAMILY_UPDATE_COMPLETED_VISITS_QUERY");
  assert.match(completedVisits, /status:\s*COMPLETED/);
  for (const field of ["id", "scheduledStart", "actualEnd", "status"]) {
    assert.match(completedVisits, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(
    completedVisits,
    /\b(?:notes|tasks|addressLine|postcode|email|phone|medication)\b/i,
  );
  assert.match(
    clientPage,
    /take = FAMILY_UPDATE_VISIT_PAGE_SIZE[\s\S]*\{ clientId, skip, take \}/,
  );
  assert.match(clientPage, /activePreparedVisitIds/);
  assert.match(eligibility, /FAMILY_UPDATE_VISIT_PAGE_SIZE = 50/);
  assert.match(eligibility, /new Set\(\["DRAFT", "PUBLISHED"\]\)/);
  assert.doesNotMatch(eligibility, /ACTIVE_PREPARED_STORY_STATUSES.*REJECTED/);
  assert.match(clientPage, /completedVisitPage/);
  assert.match(clientPage, /Previous completed visits/);
  assert.match(clientPage, /Next completed visits/);
  assert.match(
    clientPage,
    /requestedVisitPage > 1[\s\S]*loadCompletedVisits\(params\.id, 0, 1\)[\s\S]*qualifiedVisitPage\.skip/,
  );
  assert.doesNotMatch(
    clientPage,
    /\(requestedVisitPage - 1\) \* FAMILY_UPDATE_VISIT_PAGE_SIZE/,
  );
});

test("draft creation uses the canonical family-safe mutation result only", () => {
  const generate = operation("GENERATE_VERIFIED_VISIT_STORY_MUTATION");
  assert.match(generate, /generateVerifiedVisitStory/);
  assert.match(generate, /familySafeVersion/);
  assert.match(generate, /familySafeTitle/);
  assert.match(generate, /familySafeBody/);
  assert.doesNotMatch(
    generate,
    /draftTitle|draftBody|sourceRefs|notes|tasks|medication/i,
  );

  assert.match(draftClient, /useClientAccess/);
  assert.match(draftClient, /getBearerToken:\s*access\.getBearerToken/);
  assert.match(draftClient, /runSingleFlightAction/);
  assert.match(draftClient, /visitSelectRef\.current\?\.focus\(\)/);
  assert.match(
    draftClient,
    /hasVisitSelectionError = error === "Choose a completed visit\.";[\s\S]*aria-invalid=\{hasVisitSelectionError\}/,
  );
  assert.match(draftClient, /family-update-visit-error/);
  assert.match(draftClient, /aria-describedby=/);
  assert.match(draftClient, /story\.familySafeVersion !== 1/);
  assert.match(draftClient, /\/family-updates\/approvals\?careRoomId=/);
  assert.doesNotMatch(draftClient, /draftTitle|draftBody|sourceRefs/);
});

test("same-session room setup refreshes the outer server eligibility view", () => {
  assert.match(
    accessManager,
    /setRoom\(data\.createCareRoom\)[\s\S]*setNotice\([\s\S]*router\.refresh\(\)/,
  );
});

test("room and visit failures never become an empty actionable state", () => {
  assert.match(
    clientPage,
    /visitResult\.unavailable \|\| storyResult\.unavailable/,
  );
  assert.match(clientPage, /kind="unavailable"/);
  assert.match(clientPage, /We could not confirm which visits are ready/);
  assert.match(clientPage, /eligibleVisits\.length === 0/);
  assert.match(clientPage, /No completed visits are ready/);
  assert.match(clientPage, /All completed visits already have an update/);
  assert.match(clientPage, /roomResult\.room \? \(/);
});

test("created drafts enter the existing exact-preview one-time publish flow", () => {
  assert.match(approvalsPage, /careRoomId/);
  assert.match(approvalsClient, /initialCareRoomId/);
  assert.match(approvalsClient, /roomsData\.careRooms\.some/);
  assert.match(approvalItem, /story\.familySafeTitle/);
  assert.match(approvalItem, /story\.familySafeBody/);
  assert.match(approvalItem, /familySafeVersion === 1/);
  assert.match(approvalItem, /runSingleFlightAction/);
  assert.match(approvalItem, /Confirm and publish/);
});
