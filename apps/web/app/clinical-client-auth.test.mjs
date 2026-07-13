import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const providerSource = readFileSync(
  new URL("../components/providers/AppAuthProviders.tsx", import.meta.url),
  "utf8",
);
const clientAccessProviderSource = readFileSync(
  new URL("../components/providers/ClientAccessProvider.tsx", import.meta.url),
  "utf8",
);
const nextAuthOptionsSource = readFileSync(
  new URL("api/auth/[...nextauth]/authOptions.ts", import.meta.url),
  "utf8",
);
const serverAuthSource = readFileSync(
  new URL("../lib/auth/server-auth.ts", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("settings/page.tsx", import.meta.url),
  "utf8",
);
const publicHomeSource = readFileSync(new URL("page.tsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("login/page.tsx", import.meta.url), "utf8");
const metricsSource = readFileSync(
  new URL("admin/metrics/page.tsx", import.meta.url),
  "utf8",
);
const accessStateSource = readFileSync(
  new URL("access/[state]/page.tsx", import.meta.url),
  "utf8",
);

const clinicalClients = [
  "visits/new/NewVisitPageClient.tsx",
  "visits/[id]/page.tsx",
  "emar/page.tsx",
  "clients/[id]/care-logs/page.tsx",
  "shift/page.tsx",
  "clients/[id]/summary/page.tsx",
  "../components/oasis/DeleteClientButton.tsx",
];

test("auth mode installs exactly one provider-aware client access source", () => {
  assert.match(providerSource, /ClerkClientAccessProvider/);
  assert.match(providerSource, /NextAuthClientAccessProvider/);
  assert.match(providerSource, /resolveAuthMode\(process\.env\) === 'clerk'/);
  const clerkStart = providerSource.indexOf(
    "if (resolveAuthMode(process.env) === 'clerk')",
  );
  const clerkBranch = providerSource.slice(
    clerkStart,
    providerSource.indexOf("\n\n  return (", clerkStart),
  );
  assert.doesNotMatch(clerkBranch, /SessionProvider/);
  assert.match(
    settingsSource,
    /NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: process\.env\.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER/,
  );
  assert.doesNotMatch(settingsSource, /resolveAuthMode\(process\.env\)/);
});

test("provider identity changes fail closed before the next canonical snapshot resolves", () => {
  assert.match(
    clientAccessProviderSource,
    /const requestKey = `\$\{providerStatus\}:\$\{identityKey\}`/,
  );
  assert.match(
    clientAccessProviderSource,
    /resolved\.key === requestKey \? resolved\.snapshot : loadingSnapshot/,
  );
  assert.match(
    clientAccessProviderSource,
    /fetch\(["']\/api\/access-context["']/,
  );
  assert.match(
    clientAccessProviderSource,
    /window\.location\.replace\(["']\/access["']\)/,
  );
  assert.match(
    clientAccessProviderSource,
    /mountedIdentity\.current !== identityKey/,
  );
  assert.match(
    clientAccessProviderSource,
    /switchingAccount \|\| routeTransition \? <AccountTransition \/> : children/,
  );
  assert.match(
    clientAccessProviderSource,
    /resolveAuthoritativeRoute\(pathname/,
  );
  assert.match(
    clientAccessProviderSource,
    /const bypassAuthoritativeRoute = shouldBypassAuthoritativeRoute\(pathname\)/,
  );
  assert.match(
    clientAccessProviderSource,
    /!bypassAuthoritativeRoute &&[\s\S]*snapshot\.status === "loading"/,
  );
  assert.doesNotMatch(clientAccessProviderSource, /sessionClaims|token\.roles/);
  assert.doesNotMatch(
    nextAuthOptionsSource,
    /token\.roles|session as any\)\.roles/,
  );
});

test("an authenticated provider with no bearer maps to unavailable rather than signed out", () => {
  assert.match(
    serverAuthSource,
    /const providerAuthenticated = Boolean\(userId\)/,
  );
  assert.match(serverAuthSource, /: unavailableAccessSnapshot\(\)/);
  assert.match(
    serverAuthSource,
    /try \{[\s\S]*clerkAuth\.getToken\(\)[\s\S]*\} catch \{/,
  );
});

test("clinical client paths use provider-neutral access instead of NextAuth session roles", () => {
  for (const relativePath of clinicalClients) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");

    assert.match(source, /useClientAccess\(\)/, relativePath);
    assert.doesNotMatch(source, /useSession\(/, relativePath);
    if (
      !relativePath.includes("shift/") &&
      !relativePath.includes("summary/") &&
      !relativePath.includes("DeleteClient")
    ) {
      assert.match(source, /\{ getBearerToken \}/, relativePath);
    }
  }
});

test("visit creation and medication keep admin-only controls separate from staff access", () => {
  const visitCreation = readFileSync(
    new URL("visits/new/NewVisitPageClient.tsx", import.meta.url),
    "utf8",
  );
  const medication = readFileSync(
    new URL("emar/page.tsx", import.meta.url),
    "utf8",
  );
  const visitWorkspace = readFileSync(
    new URL("visits/[id]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(visitCreation, /if \(!isAdmin\)/);
  assert.match(
    medication,
    /if \(authStatus === 'loading' \|\| !authenticated \|\| !isAdmin\) return/,
  );
  assert.match(medication, /if \(!isStaff\)/);
  assert.match(
    visitWorkspace,
    /hasAccessCapability\([\s\S]*?["']FRONTLINE_VISIT_EXECUTE["']/,
  );
  assert.doesNotMatch(
    visitWorkspace,
    /canRunVisitWorkflow\s*=\s*isAdmin\s*\|\|\s*isCarer/,
  );
});

test("Carer Today and My visits use assigned-work cards instead of admin schedule controls", () => {
  const today = readFileSync(
    new URL("today/page.tsx", import.meta.url),
    "utf8",
  );
  const visits = readFileSync(
    new URL("visits/page.tsx", import.meta.url),
    "utf8",
  );
  const visitWorkspace = readFileSync(
    new URL("visits/[id]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(today, /getLondonDayUtcRange\(\)/);
  assert.match(today, /Current visit/);
  assert.match(today, /Next visit/);
  assert.match(today, /MY_ACTIVE_SHIFT_QUERY/);
  assert.match(
    visits,
    /if \(!isAdmin\) return <CarerVisits visits=\{visits\} \/>/,
  );
  assert.match(visits, /Care visits assigned to you/);
  assert.doesNotMatch(visitWorkspace, />Visit Header</);
  assert.doesNotMatch(visitWorkspace, />Step 3\. Medication Round</);
  assert.doesNotMatch(visitWorkspace, /Care note and evidence/);
  assert.match(visitWorkspace, /isAdmin &&\s*visit\?\.client/);
  assert.match(visitWorkspace, /\{isAdmin && \([\s\S]*?Open care-note records/);
});

test("public and sign-in copy avoids unsupported assurance and internal product language", () => {
  assert.match(publicHomeSource, /Available features depend on your organisation/);
  assert.match(publicHomeSource, /Open Manager Today/);
  assert.match(publicHomeSource, /Request company access/);
  assert.match(publicHomeSource, /Review family updates/);
  assert.match(publicHomeSource, /How the record moves through care/);
  assert.match(publicHomeSource, /<ol className=/);
  assert.doesNotMatch(publicHomeSource, /gradient|backdrop-blur|rounded-3xl|shadow-2xl/);
  assert.doesNotMatch(
    publicHomeSource,
    /care OS|operating system|command centre|source-linked evidence|raw-record exposure|medication support/i,
  );

  assert.match(loginSource, /What you can open depends on your assigned access/);
  assert.match(loginSource, /Contact your Manager or Oasis support/);
  assert.match(loginSource, /<main className=/);
  assert.match(loginSource, /<footer className=/);
  assert.match(loginSource, /Loading sign-in/);
  assert.doesNotMatch(loginSource, /animate-|gradient|backdrop-blur|rounded-2xl|shadow-2xl/);
  assert.doesNotMatch(
    loginSource,
    /GDPR Compliant|256-bit SSL|command centre|provider configuration|production auth|environment|local session|organisation administrator/i,
  );
  assert.doesNotMatch(loginSource, /agree to our Terms of Service/);
  assert.match(loginSource, /We could not complete sign-in\. Try again\./);
  assert.match(loginSource, /We could not sign you in\. Check your details and try again\./);
  assert.match(loginSource, /Sign-in is not available right now\. Try again or contact your Manager or Oasis support\./);
});

test("metrics page reports only observed data and has no inert refresh control", () => {
  assert.match(metricsSource, /This page does not infer service health/);
  assert.match(metricsSource, /does not prove API or database health/);
  assert.doesNotMatch(metricsSource, /✅ Online|✅ Connected|JWT \+ RBAC/);
  assert.doesNotMatch(metricsSource, />\s*Refresh\s*</);
  assert.doesNotMatch(metricsSource, /components\/ui\/Button/);
  assert.doesNotMatch(metricsSource, /authenticated API|Runtime label|Prometheus-style|administrator|Admin Access|System Metrics|Raw Metrics Data/i);
  assert.doesNotMatch(metricsSource, /error\.message|missing access token|Unknown error/);
  assert.match(metricsSource, /This page is restricted/);
  assert.match(metricsSource, /Contact Oasis support if you need access/);
  assert.doesNotMatch(metricsSource, /Manager account is required|administrator account is required/i);
});

test("access states give calm actions without resolver jargon", () => {
  assert.match(accessStateSource, /Manager/);
  assert.match(accessStateSource, /No care information has been loaded/);
  assert.match(accessStateSource, /text-slate-600/);
  assert.doesNotMatch(accessStateSource, /safely resolve|session context|tenant|organisation administrator/i);
});
