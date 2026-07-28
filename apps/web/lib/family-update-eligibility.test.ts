import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_UPDATE_VISIT_PAGE_SIZE,
  activePreparedVisitIds,
  completedVisitPageDetails,
  parseCompletedVisitPage,
} from "./family-update-eligibility";

const visitReference = (id: string) => [{ type: "Visit", id }];

test("only active draft and published stories block visit preparation", () => {
  const prepared = activePreparedVisitIds([
    {
      status: "DRAFT",
      sourceRefs: visitReference("draft-visit"),
    },
    {
      status: "PUBLISHED",
      sourceRefs: visitReference("published-visit"),
    },
    {
      status: "REJECTED",
      sourceRefs: visitReference("returned-visit"),
    },
  ]);

  assert.equal(prepared.has("draft-visit"), true);
  assert.equal(prepared.has("published-visit"), true);
  assert.equal(
    prepared.has("returned-visit"),
    false,
    "a rejected update must allow the visit to be prepared again",
  );
});

test("completed visit pagination reaches an older visit without loading over fifty", () => {
  const firstPage = completedVisitPageDetails(1, 51);
  const secondPage = completedVisitPageDetails(2, 51);

  assert.equal(FAMILY_UPDATE_VISIT_PAGE_SIZE, 50);
  assert.deepEqual(firstPage, {
    currentPage: 1,
    totalPages: 2,
    skip: 0,
    firstItem: 1,
    lastItem: 50,
    hasPrevious: false,
    hasNext: true,
  });
  assert.deepEqual(secondPage, {
    currentPage: 2,
    totalPages: 2,
    skip: 50,
    firstItem: 51,
    lastItem: 51,
    hasPrevious: true,
    hasNext: false,
  });
});

test("completed visit page input is bounded and invalid values return to page one", () => {
  assert.equal(parseCompletedVisitPage(undefined), 1);
  assert.equal(parseCompletedVisitPage("0"), 1);
  assert.equal(parseCompletedVisitPage("-1"), 1);
  assert.equal(parseCompletedVisitPage("not-a-page"), 1);
  assert.equal(parseCompletedVisitPage("2"), 2);
  assert.ok(
    parseCompletedVisitPage("999999999999999999999") <
      Number.MAX_SAFE_INTEGER,
  );
  assert.deepEqual(
    completedVisitPageDetails(
      parseCompletedVisitPage("999999999"),
      51,
    ),
    {
      currentPage: 2,
      totalPages: 2,
      skip: 50,
      firstItem: 51,
      lastItem: 51,
      hasPrevious: true,
      hasNext: false,
    },
    "an extreme page is clamped from a bounded total before its offset is used",
  );
});
