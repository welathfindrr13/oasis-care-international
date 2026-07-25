import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listPage = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const roomPage = readFileSync(
  new URL('./care-rooms/[id]/page.tsx', import.meta.url),
  'utf8',
);
const roomLoading = readFileSync(
  new URL('./care-rooms/[id]/loading.tsx', import.meta.url),
  'utf8',
);
const queries = readFileSync(
  new URL('../../lib/graphql/queries.ts', import.meta.url),
  'utf8',
);
const approvalQueueItem = readFileSync(
  new URL('../../components/carebridge/ApprovalQueueItem.tsx', import.meta.url),
  'utf8',
);
const concernForm = readFileSync(
  new URL('../../components/carebridge/FamilyConcernForm.tsx', import.meta.url),
  'utf8',
);
const familyVisitStoryList = readFileSync(
  new URL('../../components/carebridge/FamilyVisitStoryList.tsx', import.meta.url),
  'utf8',
);
const familyAssuranceRoom = readFileSync(
  new URL('../../components/carebridge/FamilyAssuranceRoom.tsx', import.meta.url),
  'utf8',
);

test('family pages use only the family-safe GraphQL operations', () => {
  assert.match(listPage, /FAMILY_CAREBRIDGE_ROOMS_QUERY/);
  assert.match(roomPage, /FAMILY_CAREBRIDGE_ROOM_QUERY/);
  assert.match(roomPage, /FAMILY_VERIFIED_VISIT_STORIES_QUERY/);
  assert.match(roomPage, /FAMILY_CARE_ROOM_CONCERNS_QUERY/);
  assert.doesNotMatch(listPage, /\n\s*CAREBRIDGE_ROOMS_QUERY[,}]/);
  assert.doesNotMatch(roomPage, /\n\s*VERIFIED_VISIT_STORIES_QUERY[,}]/);
});

test('family-safe query selections contain no staff membership or draft fields', () => {
  const roomQueries = queries.slice(
    queries.indexOf('export const FAMILY_CAREBRIDGE_ROOMS_QUERY'),
    queries.indexOf('const FAMILY_MEMBERSHIP_MUTATION_FIELDS'),
  );
  const familyContentQueries = queries.slice(
    queries.indexOf('export const FAMILY_VERIFIED_VISIT_STORIES_QUERY'),
    queries.indexOf('export const PUBLISH_VERIFIED_VISIT_STORY_MUTATION'),
  );
  const familyQueries = `${roomQueries}\n${familyContentQueries}`;
  assert.match(familyQueries, /clientDisplayName/);
  assert.match(familyQueries, /title\s+body\s+publishedAt/);
  assert.match(familyQueries, /familyCareRoomConcerns/);
  assert.match(familyQueries, /id\s+title\s+status\s+submittedAt\s+events/);
  assert.doesNotMatch(
    familyQueries,
    /memberships|familyContact|accessGrants|policy|draftTitle|draftBody|sourceRefs|approvedBy|medication|description|messages|assignedTo/i,
  );
});

test('family pages distinguish unavailable data and expose an accessible breadcrumb', () => {
  assert.match(listPage, /temporarily unavailable/);
  assert.match(listPage, /Try again/);
  assert.match(roomPage, /storiesUnavailable/);
  assert.match(roomPage, /aria-label="Breadcrumb"/);
  assert.match(roomPage, /aria-hidden="true"/);
  assert.match(roomPage, /aria-current="page"/);
  assert.match(roomPage, /accessDenied/);
  assert.match(roomPage, /Updates temporarily unavailable/);
  assert.match(roomPage, /!storiesUnavailable/);
  assert.match(roomPage, /storiesNotGranted/);
  assert.match(roomPage, /Approved updates are not included in your current family access/);
  assert.match(roomPage, /storiesNotGranted \?/);
});

test('family experience uses plain language and exposes the family-safe concern path', () => {
  const renderedFamilySources = [listPage, roomPage, familyVisitStoryList, familyAssuranceRoom].join('\n');
  assert.doesNotMatch(renderedFamilySources, /Family Assurance Room|proof-of-care/i);
  assert.match(listPage, /Latest update/);
  assert.match(listPage, /latestUpdate/);
  assert.match(roomPage, /Tell us about a concern/);
  assert.match(roomPage, /FamilyConcernForm/);
  assert.match(roomPage, /Your concerns/);
  assert.match(roomPage, /familyConcernStatusLabel/);
  assert.match(roomPage, /familyConcernEventLabel/);
  assert.match(roomPage, /StatePanel/);
  assert.match(roomLoading, /kind="loading"/);
  assert.match(concernForm, /router\.refresh\(\)/);
  assert.match(concernForm, /aria-live="polite"/);
  assert.match(roomPage, /room\.canRaiseConcerns \?/);
  assert.doesNotMatch(concernForm, /FAMILY_CONCERN_CREATE|hasAccessCapability/);
  assert.match(concernForm, /RAISE_FAMILY_CONCERN_MUTATION/);
  assert.match(roomPage, /call 999/i);
  assert.doesNotMatch(concernForm, /CAREBRIDGE_CONCERN_INBOX_QUERY|UPDATE_CAREBRIDGE_CONCERN_MUTATION/);
});

test('staff approval shows and approves the exact versioned family preview', () => {
  const approvalQuery = queries.slice(
    queries.indexOf('export const VERIFIED_VISIT_STORY_APPROVAL_QUEUE_QUERY'),
    queries.indexOf('export const FAMILY_CAREBRIDGE_ROOMS_QUERY'),
  );
  assert.match(approvalQuery, /familySafeVersion/);
  assert.match(approvalQuery, /familySafeTitle/);
  assert.match(approvalQuery, /familySafeBody/);
  assert.match(approvalQueueItem, /Exact family preview/);
  assert.match(approvalQueueItem, /Approve exact family preview/);
  assert.match(
    approvalQueueItem,
    /disabled=\{busy \|\| !hasFamilyPreview \|\| showApproveConfirmation\}/,
  );
  assert.match(approvalQueueItem, /role="alertdialog"/);
  assert.match(approvalQueueItem, /Publish this exact Family update\?/);
  assert.match(approvalQueueItem, /approveConfirmRef\.current\?\.focus\(\)/);
  assert.match(approvalQueueItem, /restoreActionFocus\(approveTriggerRef\.current\)/);
  assert.match(approvalQueueItem, /runSingleFlightAction\(approvalStartedRef/);
  assert.match(approvalQueueItem, /await onApprove\(story\.id\)/);
});
