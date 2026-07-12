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
const confirmation = readFileSync(
  new URL("../../../components/ui/ConfirmDialog.tsx", import.meta.url),
  "utf8",
);
const navigation = readFileSync(
  new URL("../../../components/oasis/headerNavigation.ts", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../../../components/oasis/Header.tsx", import.meta.url),
  "utf8",
);
const settings = readFileSync(
  new URL("../../settings/page.tsx", import.meta.url),
  "utf8",
);
const family = readFileSync(
  new URL("../../family/page.tsx", import.meta.url),
  "utf8",
);
const installPrompt = readFileSync(
  new URL("../../../components/pwa/InstallAppPrompt.tsx", import.meta.url),
  "utf8",
);
const tokens = readFileSync(
  new URL("../../../styles/tokens.css", import.meta.url),
  "utf8",
);

test("admin linking UI uses explicit membership selection without auth subject input", () => {
  assert.match(component, /useClientAccess\(\)/);
  assert.match(component, /if \(!authenticated \|\| !isAdmin\)/);
  assert.match(component, /membershipId: form\.membershipId/);
  assert.doesNotMatch(component, /authSubject/);
  assert.match(component, /never used\s+for\s+authorization/);
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
  assert.match(component, /StatePanel/);
  assert.match(component, /<Alert tone="danger" live>/);
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
  assert.match(lifecycle, /ConfirmDialog/);
  assert.doesNotMatch(lifecycle, /window\.confirm/);
  assert.match(lifecycle, /<Alert tone="danger" live>/);
  assert.match(lifecycle, /<Alert tone=\{notice\.tone\} live>/);
  assert.match(lifecycle, /getLifecycleActionNotice/);
  assert.match(
    lifecycle,
    /item\.deliveryStatus === "NEEDS_ATTENTION" \|\|[\s\S]*?item\.deliveryStatus === "UNAVAILABLE"[\s\S]*?Delivery needs administrator support/,
  );
  assert.match(lifecycle, /<caption/);
  assert.match(lifecycle, /aria-label="Carer invitations and access actions"/);
  assert.match(lifecycle, /tabIndex=\{0\}/);

  const invite =
    queries.match(/export const INVITE_CARER_MUTATION = `[\s\S]*?`;/)?.[0] ||
    "";
  assert.match(invite, /InviteCarerInput/);
  assert.doesNotMatch(invite, /organizationId|role|authSubject|external/);
});

test("representative workforce screen uses the shared operational foundation", () => {
  assert.match(page, /bg-oasis-canvas/);
  assert.match(page, /oasis-panel/);
  assert.match(page, /StatePanel/);
  assert.match(page, /StatusLabel/);
  assert.doesNotMatch(page, /bg-gradient|rounded-3xl|font-mono/);
  assert.doesNotMatch(page, /activeCarersNow:\s*0|openShiftCount:\s*0/);
  assert.match(page, /<form action="\/admin\/carers" method="get">/);
  assert.match(page, /aria-label="Assignable carers directory"/);
  assert.match(tokens, /--color-background-secondary: #f7f5f0/);
  assert.match(tokens, /--radius-sm: 8px/);
  assert.match(tokens, /--radius-lg: 12px/);
});

test("admin shell uses the required destinations without emoji navigation", () => {
  for (const label of [
    "Today",
    "People",
    "Schedule",
    "Workforce",
    "Family updates",
    "Reports",
    "Settings",
  ]) {
    assert.match(navigation, new RegExp(`label: ["']${label}["']`));
  }
  assert.doesNotMatch(navigation, /📊|👥|📅|🤝|💊|⏱️|⚙️/u);
});

test("destructive workforce actions use a keyboard-accessible dialog", () => {
  assert.match(confirmation, /<dialog/);
  assert.match(confirmation, /showModal\(\)/);
  assert.match(confirmation, /onCancel=/);
  assert.match(confirmation, /cancelRef\.current\?\.focus\(\)/);
  assert.match(confirmation, /aria-labelledby/);
  assert.match(confirmation, /aria-describedby/);
});

test("header disclosures restore focus and keep mobile targets large enough", () => {
  assert.match(header, /accountTriggerRef\.current\?\.focus\(\)/);
  assert.match(header, /navigationTriggerRef\.current\?\.focus\(\)/);
  assert.match(header, /min-h-11 min-w-11 shrink-0/);
});

test("carer profile help exposes only carer-safe operational shortcuts", () => {
  const adminShortcuts =
    settings.match(/\{isAdmin && \(\s*<>[\s\S]*?<\/\>\s*\)\}/)?.[0] || "";
  assert.match(adminShortcuts, /href="\/schedule"/);
  assert.match(adminShortcuts, /href="\/people"/);
  assert.match(adminShortcuts, /href="\/family-updates"/);
  assert.match(adminShortcuts, /href="\/medication"/);
  assert.doesNotMatch(adminShortcuts, /href="\/visits"/);
  assert.match(settings, /\{isCarer && \([\s\S]*?href="\/visits"/);
});

test("settings keep restricted management roles out of operational workspaces", () => {
  assert.match(
    settings,
    /const isRestrictedManagement =[\s\S]*?accessContext\.surface === 'staff' && accessContext\.homePath === '\/settings'/,
  );
  assert.match(
    settings,
    /\{!isRestrictedManagement && \([\s\S]*?href="\/today"/,
  );
});

test("family shell destinations and install help are truthful and reachable", () => {
  assert.match(family, /id="updates"[\s\S]*?>Updates</);
  assert.match(family, /id="concerns-help"[\s\S]*?>Concerns and help</);
  assert.match(family, /<InstallAppPrompt \/>/);
  assert.match(installPrompt, /<Button/);
  assert.match(installPrompt, /aria-expanded=\{showHelp\}/);
});
