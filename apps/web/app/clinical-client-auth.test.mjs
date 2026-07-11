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

  assert.match(visitCreation, /if \(!isAdmin\)/);
  assert.match(
    medication,
    /if \(authStatus === 'loading' \|\| !authenticated \|\| !isAdmin\) return/,
  );
  assert.match(medication, /if \(!isStaff\)/);
});
