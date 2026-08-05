import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_VISIT_CARE_TASKS,
  isUncertainVisitSubmissionError,
  validateVisitCareTasks,
  type VisitCareTaskRow,
} from "./careTasks";

function rows(labels: string[]): VisitCareTaskRow[] {
  return labels.map((label, index) => ({ id: `task-${index + 1}`, label }));
}

test("accepts zero, one and twenty care-task labels", () => {
  assert.deepEqual(validateVisitCareTasks([]), {
    labels: [],
    fieldErrors: {},
    listError: null,
  });
  assert.deepEqual(
    validateVisitCareTasks(rows(["  Support with breakfast  "])),
    {
      labels: ["Support with breakfast"],
      fieldErrors: {},
      listError: null,
    },
  );
  assert.equal(
    validateVisitCareTasks(
      rows(
        Array.from(
          { length: MAX_VISIT_CARE_TASKS },
          (_, index) => `Task ${index + 1}`,
        ),
      ),
    ).listError,
    null,
  );
});

test("allows duplicate labels without changing their order", () => {
  assert.deepEqual(
    validateVisitCareTasks(rows(["Offer a drink", "Offer a drink"])).labels,
    ["Offer a drink", "Offer a drink"],
  );
});

test("rejects blank, overlong and excessive task rows", () => {
  const blank = validateVisitCareTasks(rows(["Breakfast", "   "]));
  assert.equal(blank.listError, "Check the care tasks.");
  assert.equal(
    blank.fieldErrors["task-2"],
    "Enter a care task or remove this row.",
  );

  const overlong = validateVisitCareTasks(rows(["x".repeat(121)]));
  assert.equal(
    overlong.fieldErrors["task-1"],
    "Care tasks must be 120 characters or fewer.",
  );

  const excessive = validateVisitCareTasks(
    rows(
      Array.from(
        { length: MAX_VISIT_CARE_TASKS + 1 },
        (_, index) => `Task ${index + 1}`,
      ),
    ),
  );
  assert.equal(excessive.listError, "Add no more than 20 care tasks.");
});

test("classifies transport and ambiguous server submission errors as uncertain", () => {
  assert.equal(
    isUncertainVisitSubmissionError(new Error("Failed to fetch")),
    true,
  );
  assert.equal(
    isUncertainVisitSubmissionError(
      new Error("Request timed out after 10000ms"),
    ),
    true,
  );
  for (const status of [500, 502, 503, 504]) {
    const error = Object.assign(new Error(`GraphQL request failed: ${status}`), {
      status,
    });
    assert.equal(isUncertainVisitSubmissionError(error), true);
  }
  assert.equal(isUncertainVisitSubmissionError(new Error("Forbidden")), false);
  assert.equal(
    isUncertainVisitSubmissionError(new Error("Validation failed")),
    false,
  );
});
