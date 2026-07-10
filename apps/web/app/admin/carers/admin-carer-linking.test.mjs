import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("./CarerMembershipLinkForm.tsx", import.meta.url),
  "utf8",
);
const lifecycle = readFileSync(
  new URL("./CarerLifecycleClient.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const queries = readFileSync(
  new URL("../../../lib/graphql/queries.ts", import.meta.url),
  "utf8",
);

test("admin linking UI uses explicit membership selection without auth subject input", () => {
  assert.match(component, /useClientAccess\(\)/);
  assert.match(component, /if \(!authenticated \|\| !isAdmin\)/);
  assert.match(component, /membershipId: form\.membershipId/);
  assert.doesNotMatch(component, /authSubject/);
  assert.match(component, /never used\s+for authorization/);
  assert.doesNotMatch(component, /email: form\.email/);
});

test("successful linking removes the selected candidate and refreshes the server Carer list", () => {
  assert.match(
    component,
    /current\.filter\(\(membership\) => membership\.id !== linkedMembershipId\)/,
  );
  assert.match(component, /router\.refresh\(\)/);
  assert.match(component, /was created and linked/);
  assert.match(page, /CARERS_QUERY/);
  assert.match(page, /ELIGIBLE_CARER_MEMBERSHIPS_QUERY/);
});

test("loading failures remain distinct from a genuine empty eligible-membership state", () => {
  assert.match(component, /Eligible workforce logins could not be loaded/);
  assert.match(component, /No eligible unlinked carer or staff logins/);
  assert.match(component, /The Carer was not created or linked/);
  assert.match(component, /role="alert"/);
});

test("GraphQL create-and-link input exposes membership and profile fields only", () => {
  const mutation =
    queries.match(
      /export const CREATE_AND_LINK_CARER_MUTATION = `[\s\S]*?`;/,
    )?.[0] || "";
  assert.match(mutation, /CreateLinkedCarerInput/);
  assert.match(mutation, /membershipId/);
  assert.doesNotMatch(mutation, /authSubject|organizationId/);
});

test("Carer lifecycle UI fixes tenant and role server-side and exposes only stable action IDs", () => {
  assert.match(lifecycle, /emailAddress: email/);
  assert.doesNotMatch(
    lifecycle,
    /organizationId|authSubject|externalInvitationId|externalMembershipId/,
  );
  assert.match(lifecycle, /REVOKE_CARER_INVITATION_MUTATION/);
  assert.match(lifecycle, /REISSUE_CARER_INVITATION_MUTATION/);
  assert.match(lifecycle, /DEACTIVATE_CARER_MEMBERSHIP_MUTATION/);
  assert.match(lifecycle, /window\.confirm/);
  assert.match(lifecycle, /role="alert"/);
  assert.match(lifecycle, /aria-live="polite"/);
  assert.match(lifecycle, /<caption/);

  const invite =
    queries.match(/export const INVITE_CARER_MUTATION = `[\s\S]*?`;/)?.[0] ||
    "";
  assert.match(invite, /InviteCarerInput/);
  assert.doesNotMatch(invite, /organizationId|role|authSubject|external/);
});
