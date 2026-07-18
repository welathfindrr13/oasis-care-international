import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const form = read("./request-access/RequestAccessForm.tsx");
const requestPage = read("./request-access/page.tsx");
const publicProxy = read("./api/company-access-requests/route.ts");
const graphqlProxy = read("./api/graphql/route.ts");
const operatorPage = read(
  "./platform/company-requests/PlatformCompanyRequestsClient.tsx",
);
const operatorServerPage = read("./platform/company-requests/page.tsx");
const setupPage = read("./admin/setup/page.tsx");
const acceptInvitationPage = read(
  "./accept-invitation/AcceptInvitationClient.tsx",
);
const activationClient = read("./activate-invitation/ActivationClient.tsx");

test("public intake collects only minimal business contact details", () => {
  for (const field of [
    "companyName",
    "contactName",
    "businessEmail",
    "operationalNote",
  ]) {
    assert.match(form, new RegExp(`name="${field}"`));
  }
  assert.doesNotMatch(
    form,
    /name="(?:phone|client|patient|medical|clinical|careRecord)/i,
  );
  assert.match(form, /maxLength=\{500\}/);
  assert.match(
    requestPage,
    /No client,[\s\S]*care-record information is[\s\S]*needed/,
  );
});

test("new and duplicate submissions share one non-enumerating confirmation", () => {
  assert.match(form, /If your request is eligible/);
  assert.match(
    form,
    /does not create[\s\S]*active Oasis[\s\S]*organization or user account/,
  );
  assert.doesNotMatch(
    form,
    /requestId|request ID|already exists|duplicate request/i,
  );
  assert.match(
    publicProxy,
    /return NextResponse\.json\(\{ accepted: true \}, \{ status: 202 \}\)/,
  );
});

test("platform mutations carry one explicitly allowlisted confirmation header", () => {
  assert.match(operatorPage, /["']X-Oasis-Platform-Action["']:\s*["']1["']/);
  assert.match(operatorPage, /router\.refresh\(\)/);
  assert.match(operatorPage, /setItems\(initialItems\)/);
  assert.match(
    graphqlProxy,
    /request\.headers\.get\('x-oasis-platform-action'\)/,
  );
  assert.match(graphqlProxy, /headers\['X-Oasis-Platform-Action'\] = '1'/);
  assert.doesNotMatch(
    graphqlProxy,
    /Object\.fromEntries\(request\.headers|headers:\s*request\.headers/,
  );
});

test("platform operators can inspect every request status with bounded pagination", () => {
  for (const status of [
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXPIRED",
    "DISABLED",
  ]) {
    assert.match(operatorServerPage, new RegExp(`['\"]${status}['\"]`));
  }
  assert.match(operatorServerPage, /\$status:[\s\S]*\$offset:[\s\S]*\$limit:/);
  assert.match(operatorServerPage, /const PAGE_SIZE = 50/);
  assert.match(operatorServerPage, /10_000/);
  assert.match(operatorServerPage, /Previous/);
  assert.match(operatorServerPage, /Next/);
  assert.match(operatorServerPage, /key=\{`\$\{status\}:\$\{page\.offset\}`\}/);
});

test("Platform Owners revoke the exact first Manager with accessible recovery states", () => {
  assert.match(operatorServerPage, /bootstrapManagerEmail/);
  assert.match(operatorServerPage, /bootstrapManagerAccessStatus/);
  assert.match(operatorServerPage, /bootstrapManagerCleanupStatus/);
  assert.match(operatorPage, /revokeBootstrapManagerAccess/);
  assert.match(operatorPage, /Revoke first Manager/);
  assert.match(operatorPage, /Revoke access for/);
  assert.match(operatorPage, /company and care records will remain/i);
  assert.match(operatorPage, /No replacement Manager will be created/);
  assert.match(operatorPage, /appoint one separately/);
  assert.match(operatorPage, /Retry Clerk cleanup/);
  assert.match(operatorPage, /Oasis access remains revoked/);
  assert.match(operatorPage, /returnFocusId="company-requests-heading"/);
  assert.match(operatorPage, /<Alert live tone="success"/);
  assert.match(operatorPage, /role="alert"/);
  assert.match(operatorPage, /href=\{`#\$\{error\.targetId\}`\}/);
  assert.doesNotMatch(
    operatorPage,
    /createReplacementManager|appointReplacementManager/,
  );
});

test("guided setup presents the real company journey without internal language", () => {
  assert.match(setupPage, /Set up your company/);
  assert.match(setupPage, /Add a person/);
  assert.match(setupPage, /Invite a carer/);
  assert.match(setupPage, /must accept the invitation before you can assign/);
  assert.match(setupPage, /Schedule a visit/);
  assert.match(setupPage, /Set up family updates/);
  assert.match(setupPage, /viewerOrganizationSetupDetails/);
  assert.doesNotMatch(
    setupPage,
    /\bid\b|internal|synthetic|canary|fixture|seed|developer|billing/i,
  );
});

test("Clerk invitations authenticate and activate before entering guided setup", () => {
  assert.match(acceptInvitationPage, /forceRedirectUrl=\{activationUrl\}/);
  assert.match(
    acceptInvitationPage,
    /signUpForceRedirectUrl=\{activationUrl\}/,
  );
  assert.match(acceptInvitationPage, /__clerk_ticket/);
  assert.match(acceptInvitationPage, /__clerk_status/);
  assert.match(acceptInvitationPage, /invalid or incomplete/i);
  assert.match(acceptInvitationPage, /Sign out and continue/);
  assert.match(acceptInvitationPage, /clerk\.signOut/);
  assert.match(activationClient, /activateViewerOrganizationInvitation/);
  assert.match(activationClient, /oasis_invitation_id/);
  assert.match(activationClient, /clerk\.setActive/);
  assert.match(
    activationClient,
    /router\.replace\(data\.activateViewerOrganizationInvitation\.nextPath\)/,
  );
  assert.doesNotMatch(activationClient, /email|organizationId:\s*input/i);
});
