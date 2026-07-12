import assert from "node:assert/strict";
import test from "node:test";
import type { CarerAccessLifecycleItem } from "../../../lib/graphql/queries";
import {
  getInvitationSavedNotice,
  getLifecycleActionNotice,
} from "./carerLifecycleOutcome";

function lifecycle(
  overrides: Partial<CarerAccessLifecycleItem>,
): CarerAccessLifecycleItem {
  return {
    lifecycleId: "lifecycle-1",
    invitationId: "invitation-1",
    membershipId: null,
    carerId: null,
    emailAddress: "synthetic.carer@example.invalid",
    status: "PENDING",
    readiness: "AWAITING_ACCEPTANCE",
    deliveryStatus: "DELIVERED",
    cleanupStatus: "COMPLETE",
    expiresAt: "2030-01-01T00:00:00.000Z",
    canRevoke: true,
    canReissue: false,
    canRetryDelivery: false,
    canLink: false,
    canDeactivate: false,
    ...overrides,
  };
}

test("delivery failures never produce a green success notice", () => {
  for (const deliveryStatus of [
    "RETRYABLE",
    "NEEDS_ATTENTION",
    "UNAVAILABLE",
  ] as const) {
    const item = lifecycle({ deliveryStatus });
    assert.equal(getInvitationSavedNotice(item).tone, "attention");
    assert.equal(getLifecycleActionNotice("retry", item).tone, "attention");
    assert.equal(getLifecycleActionNotice("reissue", item).tone, "attention");
  }
});

test("reissue cleanup failures say no replacement was sent", () => {
  for (const cleanupStatus of ["PENDING", "MANUAL_REVIEW"] as const) {
    const notice = getLifecycleActionNotice(
      "reissue",
      lifecycle({ status: "REVOKED", cleanupStatus }),
    );
    assert.equal(notice.tone, "attention");
    assert.match(notice.message, /No replacement/);
  }
});

test("only completed delivery and cleanup outcomes are successful", () => {
  assert.deepEqual(getLifecycleActionNotice("retry", lifecycle({})), {
    tone: "success",
    message: "Secure invitation delivery completed.",
  });
  assert.equal(
    getLifecycleActionNotice(
      "revoke",
      lifecycle({ status: "REVOKED", cleanupStatus: "COMPLETE" }),
    ).tone,
    "success",
  );
  assert.equal(
    getLifecycleActionNotice(
      "deactivate",
      lifecycle({
        status: "REVOKED",
        readiness: "DISABLED",
        cleanupStatus: "MANUAL_REVIEW",
      }),
    ).tone,
    "attention",
  );
});
