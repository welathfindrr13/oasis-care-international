import { expect, test, type Page } from "playwright/test";

const ISSUER = "http://127.0.0.1:4011";
const SESSION_KEY = "oasis.synthetic-clerk-session";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CARE_ROOM_MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SENTINEL_CLIENT_ID = "client-browser-sentinel";
const SENTINEL_CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";

type Profile = "manager" | "carer" | "family";
type RejectedProfile =
  | "invalid_signature"
  | "invalid_issuer"
  | "invalid_audience"
  | "invalid_authorized_party"
  | "expired";

async function tokenFor(
  request: Page["request"],
  profile: Profile | RejectedProfile,
) {
  const tokenResponse = await request.get(`${ISSUER}/tokens/${profile}`);
  expect(tokenResponse.ok()).toBe(true);
  const { token } = (await tokenResponse.json()) as { token: string };
  return token;
}

async function activateSignedProfile(page: Page, profile: Profile) {
  const token = await tokenFor(page.request, profile);

  await page.context().addCookies([
    {
      name: "__session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  if (!page.url().startsWith("http://localhost:3004")) {
    await page.goto("/login");
  }
  await page.evaluate(
    ({ key, signedToken }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ signedIn: true, token: signedToken }),
      );
      window.dispatchEvent(new Event("oasis-synthetic-clerk-session"));
    },
    { key: SESSION_KEY, signedToken: token },
  );
  return token;
}

test("the normal API rejects invalid Clerk signatures and security claims", async ({
  page,
}) => {
  for (const profile of [
    "invalid_signature",
    "invalid_issuer",
    "invalid_audience",
    "invalid_authorized_party",
    "expired",
  ] as const satisfies readonly RejectedProfile[]) {
    await test.step(profile, async () => {
      const token = await tokenFor(page.request, profile);
      const response = await page.request.post(
        "http://localhost:4001/graphql",
        {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            query: `query RejectedViewer {
            viewerAccessSnapshot { authenticated organizationId surface }
          }`,
          },
        },
      );
      expect(response.status()).toBe(200);
      const payload = (await response.json()) as {
        data?: { viewerAccessSnapshot?: unknown } | null;
        errors?: Array<{ extensions?: { code?: string } }>;
      };
      expect(payload.data?.viewerAccessSnapshot).toBeFalsy();
      expect(["UNAUTHENTICATED", "INTERNAL_ERROR"]).toContain(
        payload.errors?.[0]?.extensions?.code,
      );
    });
  }
});

test("a server-signed management session reaches the normal Clerk verifier and stays tenant-bound", async ({
  page,
}) => {
  await activateSignedProfile(page, "manager");

  const accessResponse = await page.request.get("/api/access-context");
  expect(accessResponse.status()).toBe(200);
  await expect(accessResponse.json()).resolves.toMatchObject({
    organizationId: "org-browser-linked-carer",
    effectiveRole: "admin",
    membershipState: "ACTIVE",
    surface: "ADMIN",
    resolution: "READY",
  });

  await page.goto("/people");
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  await page.goto(`/people/${SENTINEL_CLIENT_ID}`);
  await expect(
    page.getByRole("heading", {
      name: /Person Not Found|Unable to Load Person/,
    }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);
});

test("a token carrying an admin claim is reduced to its linked Carer assignment", async ({
  page,
}) => {
  await activateSignedProfile(page, "carer");

  const accessResponse = await page.request.get("/api/access-context");
  expect(accessResponse.status()).toBe(200);
  await expect(accessResponse.json()).resolves.toMatchObject({
    organizationId: "org-browser-linked-carer",
    effectiveRole: "carer",
    membershipState: "ACTIVE",
    surface: "STAFF",
    linkedIdentityState: "LINKED",
    resolution: "READY",
  });

  await page.goto("/visits");
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/schedule/${UNASSIGNED_VISIT_ID}"]`),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Workforce", exact: true }),
  ).toHaveCount(0);
});

test("Family access is grant-bound, tenant-safe, and revoked immediately with the same signed session", async ({
  page,
}) => {
  const familyToken = await activateSignedProfile(page, "family");

  const accessResponse = await page.request.get("/api/access-context");
  expect(accessResponse.status()).toBe(200);
  await expect(accessResponse.json()).resolves.toMatchObject({
    organizationId: "org-browser-linked-carer",
    effectiveRole: "family",
    membershipState: "ACTIVE",
    surface: "FAMILY",
    linkedIdentityState: "LINKED",
    resolution: "READY",
  });

  await page.goto("/family");
  await expect(
    page.getByText("A comfortable morning visit", { exact: true }).first(),
  ).toBeVisible();
  await page.goto(`/family/care-rooms/${SENTINEL_CARE_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "Updates temporarily unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);

  const managerToken = await tokenFor(page.request, "manager");
  const revokeResponse = await page.request.post("/api/graphql", {
    headers: { Authorization: `Bearer ${managerToken}` },
    data: {
      query: `mutation Revoke($input: FamilyMembershipActionInput!) {
        revokeFamilyAccess(input: $input) { status accessGrants { scope } }
      }`,
      variables: {
        input: { careRoomMembershipId: CARE_ROOM_MEMBERSHIP_ID },
      },
    },
  });
  expect(revokeResponse.status()).toBe(200);
  await expect(revokeResponse.json()).resolves.toMatchObject({
    data: { revokeFamilyAccess: { status: "REVOKED", accessGrants: [] } },
  });

  expect(familyToken).toContain(".");
  const deniedResponse = await page.request.get("/api/access-context");
  expect(deniedResponse.status()).toBe(200);
  await expect(deniedResponse.json()).resolves.toMatchObject({
    membershipState: "ACTIVE",
    effectiveRole: "family",
    surface: "NONE",
    onboardingState: "BLOCKED",
    resolution: "DENIED",
  });

  await page.goto(`/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(page).toHaveURL(/\/access\/unavailable$/);
  await expect(
    page.getByText("No care information has been loaded."),
  ).toBeVisible();
  await expect(page.getByText("Assigned Fake Client")).toHaveCount(0);
});
