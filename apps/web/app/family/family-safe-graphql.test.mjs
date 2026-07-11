import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listPage = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const roomPage = readFileSync(
  new URL('./care-rooms/[id]/page.tsx', import.meta.url),
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

test('family pages use only the family-safe GraphQL operations', () => {
  assert.match(listPage, /FAMILY_CAREBRIDGE_ROOMS_QUERY/);
  assert.match(roomPage, /FAMILY_CAREBRIDGE_ROOM_QUERY/);
  assert.match(roomPage, /FAMILY_VERIFIED_VISIT_STORIES_QUERY/);
  assert.doesNotMatch(listPage, /\n\s*CAREBRIDGE_ROOMS_QUERY[,}]/);
  assert.doesNotMatch(roomPage, /\n\s*VERIFIED_VISIT_STORIES_QUERY[,}]/);
});

test('family-safe query selections contain no staff membership or draft fields', () => {
  const familyQueries = queries.slice(
    queries.indexOf('export const FAMILY_CAREBRIDGE_ROOMS_QUERY'),
    queries.indexOf('export const PUBLISH_VERIFIED_VISIT_STORY_MUTATION'),
  );
  assert.match(familyQueries, /clientDisplayName/);
  assert.match(familyQueries, /title\s+body\s+publishedAt/);
  assert.doesNotMatch(
    familyQueries,
    /memberships|familyContact|accessGrants|policy|draftTitle|draftBody|sourceRefs|approvedBy|medication/i,
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
  assert.match(roomPage, /Room temporarily unavailable/);
  assert.match(roomPage, /!storiesUnavailable/);
  assert.match(roomPage, /storiesNotGranted/);
  assert.match(roomPage, /Approved updates are not included in your current family access/);
  assert.match(roomPage, /storiesNotGranted \?/);
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
  assert.match(approvalQueueItem, /disabled=\{busy \|\| !hasFamilyPreview\}/);
});
