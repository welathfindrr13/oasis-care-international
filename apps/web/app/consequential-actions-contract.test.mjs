import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const carePlanningActions = readFileSync(
  new URL(
    "../components/care-planning/CarePlanningActions.tsx",
    import.meta.url,
  ),
  "utf8",
);
const approvalQueueItem = readFileSync(
  new URL("../components/carebridge/ApprovalQueueItem.tsx", import.meta.url),
  "utf8",
);
const visitDetail = readFileSync(
  new URL("./visits/[id]/page.tsx", import.meta.url),
  "utf8",
);

test("each consequential UI path uses the executable single-flight confirmation boundary", () => {
  assert.match(
    carePlanningActions,
    /runSingleFlightAction\(consequentialActionStartedRef/,
  );
  assert.equal(
    (carePlanningActions.match(/runConfirmedAction\(/g) ?? []).length,
    3,
  );

  assert.match(approvalQueueItem, /runSingleFlightAction\(approvalStartedRef/);
  assert.match(
    approvalQueueItem,
    /restoreActionFocus\(approveTriggerRef\.current\)/,
  );

  assert.match(visitDetail, /runSingleFlightAction\(completionStartedRef/);
  assert.match(visitDetail, /runConfirmedAction\(/);
});
