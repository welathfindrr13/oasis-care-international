import type { ConfigService } from "@nestjs/config";
import {
  VisitCompletionProofKeyring,
  visitCompletionRecordProofPayload,
  visitCompletionRequestProofPayload,
} from "./visit-completion-proof-keyring";

const ACTIVE_SECRET = "active-visit-completion-proof-secret-32-bytes-minimum";
const PREVIOUS_SECRET =
  "previous-visit-completion-proof-secret-32-bytes-minimum";

function keyring(values: Record<string, string | undefined>) {
  return new VisitCompletionProofKeyring({
    get: (name: string) => values[name],
  } as ConfigService);
}

function context() {
  return {
    organizationId: "org-1",
    visitId: "visit-1",
    expectedCarerId: "carer-1",
    authSubject: "subject-1",
    membershipId: "membership-1",
    actorRole: "carer",
    actorSurface: "STAFF",
  };
}

describe("VisitCompletionProofKeyring", () => {
  it.each([
    [{ VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1" }, "secret"],
    [
      {
        VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
        VISIT_COMPLETION_PROOF_ACTIVE_SECRET: "too-short",
      },
      "32 bytes",
    ],
  ])("rejects missing or weak active proof config", (values, message) => {
    expect(() => keyring(values)).toThrow(message);
  });

  it("requires previous key id and secret together", () => {
    expect(() =>
      keyring({
        VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v2",
        VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
        VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "v1",
      }),
    ).toThrow("configured together");
  });

  it.each([
    ["v2", PREVIOUS_SECRET, "identifiers"],
    ["v1", ACTIVE_SECRET, "distinct secrets"],
  ])(
    "rejects unsafe active/previous key reuse",
    (previousKeyId, previousSecret, message) => {
      expect(() =>
        keyring({
          VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v2",
          VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
          VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: previousKeyId,
          VISIT_COMPLETION_PROOF_PREVIOUS_SECRET: previousSecret,
        }),
      ).toThrow(message);
    },
  );

  it("verifies a controlled previous key and fails closed for an unknown key", () => {
    const previous = keyring({
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: PREVIOUS_SECRET,
    });
    const payload = visitCompletionRequestProofPayload({
      context: context(),
      actualEndWasProvided: true,
      requestedActualEnd: "2026-07-13T10:00:00.000Z",
      completionNote: "Client comfortable.",
    });
    const oldProof = previous.sign("request", payload);
    const rotated = keyring({
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v2",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
      VISIT_COMPLETION_PROOF_PREVIOUS_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_PREVIOUS_SECRET: PREVIOUS_SECRET,
    });

    expect(
      rotated.verify(oldProof.keyId, "request", payload, oldProof.fingerprint),
    ).toBe(true);
    expect(
      rotated.verify("unknown", "request", payload, oldProof.fingerprint),
    ).toBe(false);
  });

  it("is independent from JWT secret rotation", () => {
    const first = keyring({
      JWT_SECRET: "jwt-secret-one-that-is-not-a-proof-key",
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
    });
    const second = keyring({
      JWT_SECRET: "different-jwt-secret-after-auth-rotation",
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
    });
    const payload = visitCompletionRecordProofPayload({
      context: context(),
      notes: "Recorded note",
      actualEnd: "2026-07-13T10:00:00.000Z",
    });
    const proof = first.sign("record", payload);

    expect(
      second.verify(proof.keyId, "record", payload, proof.fingerprint),
    ).toBe(true);
  });

  it.each([
    ["organizationId", "org-2"],
    ["visitId", "visit-2"],
    ["expectedCarerId", "carer-2"],
    ["authSubject", "subject-2"],
    ["membershipId", "membership-2"],
    ["actorRole", "staff"],
    ["actorSurface", "FAMILY"],
  ] as const)("binds the %s context field", (field, changedValue) => {
    const ring = keyring({
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
    });
    const originalPayload = visitCompletionRequestProofPayload({
      context: context(),
      actualEndWasProvided: false,
      requestedActualEnd: null,
      completionNote: "Client comfortable.",
    });
    const proof = ring.sign("request", originalPayload);
    const changedPayload = visitCompletionRequestProofPayload({
      ...originalPayload,
      context: { ...originalPayload.context, [field]: changedValue },
    });

    expect(
      ring.verify(proof.keyId, "request", changedPayload, proof.fingerprint),
    ).toBe(false);
  });

  it("domain-separates request and persisted-record proofs", () => {
    const ring = keyring({
      VISIT_COMPLETION_PROOF_ACTIVE_KEY_ID: "v1",
      VISIT_COMPLETION_PROOF_ACTIVE_SECRET: ACTIVE_SECRET,
    });
    const payload = { context: context(), notes: "same", actualEnd: null };
    const proof = ring.sign("request", payload);

    expect(ring.verify(proof.keyId, "record", payload, proof.fingerprint)).toBe(
      false,
    );
  });
});
