import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchAuthoritativeAccessSnapshot,
  parseAccessSnapshot,
  rolesFromAccessSnapshot,
} from "./access-snapshot";

const adminPayload = {
  authenticated: true,
  organizationId: "org-1",
  effectiveRole: "admin",
  membershipState: "ACTIVE",
  surface: "ADMIN",
  linkedIdentityState: "NOT_REQUIRED",
  onboardingState: "READY",
  capabilities: [
    "PROFILE_HELP_VIEW",
    "TENANT_ADMIN",
    "PEOPLE_MANAGE",
    "WORKFORCE_MANAGE",
    "SCHEDULE_MANAGE",
    "FAMILY_ACCESS_MANAGE",
    "OPERATIONAL_REPORTS_VIEW",
    "AI_SUMMARY_REVIEW",
    "AI_SUMMARY_GENERATE",
    "AI_SUMMARY_CONFIGURE",
    "GDPR_MANAGE",
  ],
  medicationEmarEnabled: false,
};

test("parses only the safe canonical contract and derives roles from its surface", () => {
  const parsed = parseAccessSnapshot(adminPayload);
  assert(parsed);
  assert.equal(parsed.resolution, "READY");
  assert.deepEqual(rolesFromAccessSnapshot(parsed), ["admin"]);
  assert.deepEqual(parsed.capabilities, adminPayload.capabilities);
  assert.equal(parsed.medicationEmarEnabled, false);
  assert.equal(
    parseAccessSnapshot({ ...adminPayload, medicationEmarEnabled: true })
      ?.medicationEmarEnabled,
    true,
  );
  for (const malformed of [undefined, null, "true", "false", 1]) {
    const candidate = { ...adminPayload, medicationEmarEnabled: malformed };
    assert.equal(parseAccessSnapshot(candidate)?.medicationEmarEnabled, false);
  }
  assert.equal(
    parseAccessSnapshot({
      ...adminPayload,
      capabilities: ["TENANT_ADMIN", "UNKNOWN_CAPABILITY"],
    }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({ ...adminPayload, surface: "SUPERUSER" }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({ ...adminPayload, organizationId: null }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({
      ...adminPayload,
      surface: "FAMILY",
      effectiveRole: "family",
      linkedIdentityState: "NOT_REQUIRED",
    }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({
      ...adminPayload,
      surface: "STAFF",
      effectiveRole: "carer",
      linkedIdentityState: "REQUIRED",
    }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({
      ...adminPayload,
      surface: "STAFF",
      effectiveRole: null,
    }),
    null,
  );
  assert.equal(
    parseAccessSnapshot({
      ...adminPayload,
      surface: "ADMIN",
      effectiveRole: "carer",
    }),
    null,
  );
});

test("fetch forwards the bearer token and never uses provider role claims", async () => {
  let request: RequestInit | undefined;
  const snapshot = await fetchAuthoritativeAccessSnapshot("signed-token", {
    apiUrl: "https://api.example.test/graphql",
    fetchImpl: (async (_url, init) => {
      request = init;
      return new Response(
        JSON.stringify({ data: { viewerAccessSnapshot: adminPayload } }),
        { status: 200 },
      );
    }) as typeof fetch,
  });
  assert.equal(snapshot.surface, "ADMIN");
  assert.equal(
    (request?.headers as Record<string, string>).Authorization,
    "Bearer signed-token",
  );
  assert.doesNotMatch(
    String(request?.body),
    /org_role|sessionClaims|public_metadata/,
  );
});

test("infrastructure and GraphQL errors collapse to one sanitized unavailable snapshot", async () => {
  for (const fetchImpl of [
    (async () => {
      throw new Error("postgresql://secret@private-host/internal");
    }) as typeof fetch,
    (async () =>
      new Response(
        JSON.stringify({
          errors: [{ message: "table organization_membership missing" }],
        }),
        { status: 200 },
      )) as typeof fetch,
  ]) {
    const snapshot = await fetchAuthoritativeAccessSnapshot("signed-token", {
      fetchImpl,
      timeoutMs: 50,
    });
    assert.equal(snapshot.resolution, "UNAVAILABLE");
    assert.equal(snapshot.organizationId, null);
    assert.equal(JSON.stringify(snapshot).includes("secret"), false);
    assert.equal(
      JSON.stringify(snapshot).includes("organization_membership"),
      false,
    );
  }
});
