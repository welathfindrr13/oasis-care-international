import { expect, test, type Page } from "playwright/test";

const ISSUER = "http://127.0.0.1:4011";
const SESSION_KEY = "oasis.synthetic-clerk-session";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ARCHIVE_CLIENT_ID = "45454545-4545-4454-8454-454545454545";
const ARCHIVE_CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-dddddddddddd";
const CARE_ROOM_MEMBERSHIP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLIENT_ID = "client-browser-linked-carer";
const SENTINEL_CLIENT_ID = "client-browser-sentinel";
const SENTINEL_CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";

type Profile = "platform_operator" | "manager" | "carer" | "family";
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

async function gotoAppRoute(page: Page, pathname: string) {
  try {
    await page.goto(pathname);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("net::ERR_ABORTED")
    ) {
      throw error;
    }

    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
    if (new URL(page.url()).pathname !== pathname) {
      await page.goto(pathname);
    }
  }
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
    await gotoAppRoute(page, "/login");
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

  await gotoAppRoute(page, "/people");
  await expect(
    page.getByRole("table").getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  await gotoAppRoute(page, `/people/${SENTINEL_CLIENT_ID}`);
  await expect(
    page.getByRole("heading", {
      name: /Person not found|Unable to load person|Client not found|Unable to load client/i,
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

  await gotoAppRoute(page, "/visits");
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

test("archiving one client ends that room's authority on the next signed request while shared Family access remains", async ({
  page,
  browser,
}) => {
  const familyToken = await activateSignedProfile(page, "family");
  const before = await page.request.post("/api/graphql", {
    headers: { Authorization: `Bearer ${familyToken}` },
    data: {
      query: `query FamilyRoomsBeforeArchive {
        familyCareRooms { id clientDisplayName }
      }`,
    },
  });
  expect(before.status()).toBe(200);
  expect(
    ((await before.json()) as {
      data: { familyCareRooms: Array<{ id: string }> };
    }).data.familyCareRooms.map((room) => room.id),
  ).toEqual(expect.arrayContaining([CARE_ROOM_ID, ARCHIVE_CARE_ROOM_ID]));

  const managerContext = await browser.newContext({
    baseURL: "http://localhost:3004",
  });
  const managerPage = await managerContext.newPage();
  await activateSignedProfile(managerPage, "manager");
  await gotoAppRoute(managerPage, `/clients/${ARCHIVE_CLIENT_ID}`);
  await managerPage.getByRole("button", { name: "Archive client" }).click();
  const dialog = managerPage.getByRole("dialog", {
    name: "Archive Archive Boundary Client?",
  });
  await dialog.getByRole("button", { name: "Archive client" }).click();
  await expect(managerPage).toHaveURL(/\/clients\?archived=1$/);
  await managerContext.close();

  const after = await page.request.post("/api/graphql", {
    headers: { Authorization: `Bearer ${familyToken}` },
    data: {
      query: `query FamilyRoomsAfterArchive {
        familyCareRooms { id clientDisplayName }
      }`,
    },
  });
  expect(after.status()).toBe(200);
  await expect(after.json()).resolves.toEqual({
    data: {
      familyCareRooms: [
        {
          id: CARE_ROOM_ID,
          clientDisplayName: "Assigned Fake Client",
        },
      ],
    },
  });

  const roomQuery = (id: string) =>
    page.request.post("/api/graphql", {
      headers: { Authorization: `Bearer ${familyToken}` },
      data: {
        query: `query FamilyRoomAfterArchive($id: String!) {
          familyCareRoom(id: $id) { id }
        }`,
        variables: { id },
      },
    });
  const [archived, random] = await Promise.all([
    roomQuery(ARCHIVE_CARE_ROOM_ID),
    roomQuery("00000000-0000-4000-8000-000000000000"),
  ]);
  const archivedBody = (await archived.json()) as {
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };
  const randomBody = (await random.json()) as {
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };
  expect(archivedBody.errors?.[0]).toEqual(randomBody.errors?.[0]);
});

test("Family access is grant-bound, tenant-safe, and revoked immediately with the same signed session", async ({
  page,
  browser,
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

  await gotoAppRoute(page, "/family");
  await expect(
    page.getByText("A comfortable morning visit", { exact: true }).first(),
  ).toBeVisible();
  await gotoAppRoute(page, `/family/care-rooms/${SENTINEL_CARE_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "Updates unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);

  const managerContext = await browser.newContext({
    baseURL: "http://localhost:3004",
  });
  const managerPage = await managerContext.newPage();
  const managerToken = await activateSignedProfile(managerPage, "manager");

  await gotoAppRoute(managerPage, `/clients/${CLIENT_ID}/carebridge`);
  await expect(managerPage).toHaveURL(
    new RegExp(`/clients/${CLIENT_ID}/carebridge$`),
  );
  await expect(
    managerPage.getByRole("heading", {
      name: "Family access for Assigned Fake Client",
    }),
  ).toBeVisible();
  await expect(managerPage.getByText("TEST ONLY Sentinel Person")).toHaveCount(
    0,
  );

  const membershipCard = managerPage.locator(
    `#family-membership-${CARE_ROOM_MEMBERSHIP_ID}`,
  );
  await expect(membershipCard.getByText("Browser Family")).toBeVisible();

  const approvedUpdates = membershipCard.getByRole("checkbox", {
    name: /Approved care updates/,
  });
  const concerns = membershipCard.getByRole("checkbox", {
    name: /Send concerns/,
  });
  await expect(approvedUpdates).toBeChecked();
  await expect(concerns).toBeChecked();

  await concerns.uncheck();
  await membershipCard
    .getByRole("button", { name: "Save sharing choices" })
    .click();
  await expect(
    managerPage
      .getByRole("status")
      .filter({ hasText: "Sharing choices saved for Browser Family." }),
  ).toBeVisible();

  const authorityResponse = await page.request.post("/api/graphql", {
    headers: { Authorization: `Bearer ${familyToken}` },
    data: {
      query: `query FamilyAuthority {
        familyCareRooms {
          id
          clientDisplayName
          canViewApprovedUpdates
          canRaiseConcerns
        }
      }`,
    },
  });
  expect(authorityResponse.status()).toBe(200);
  await expect(authorityResponse.json()).resolves.toEqual({
    data: {
      familyCareRooms: [
        {
          id: CARE_ROOM_ID,
          clientDisplayName: "Assigned Fake Client",
          canViewApprovedUpdates: true,
          canRaiseConcerns: false,
        },
      ],
    },
  });

  await membershipCard.getByRole("button", { name: "Revoke access" }).click();
  const revokeDialog = managerPage.getByRole("dialog", {
    name: "Revoke access for Browser Family?",
  });
  await expect(revokeDialog).toContainText(
    "Their access to Assigned Fake Client will stop immediately.",
  );
  await revokeDialog
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await expect(
    managerPage
      .getByRole("status")
      .filter({ hasText: "Access revoked for Browser Family." }),
  ).toBeVisible();
  await expect(membershipCard).toContainText("Access ended");

  expect(managerToken).toContain(".");
  await managerContext.close();
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

  await gotoAppRoute(page, `/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(page).toHaveURL(/\/access\/unavailable$/);
  await expect(
    page.getByText("No care information has been loaded."),
  ).toBeVisible();
  await expect(page.getByText("Assigned Fake Client")).toHaveCount(0);
});

test("an authenticated Manager receives a calm non-leaking Platform denial", async ({
  page,
}) => {
  await activateSignedProfile(page, "manager");
  await gotoAppRoute(page, "/platform/company-requests");

  await expect(
    page.getByRole("heading", { name: "Platform access", exact: true }),
  ).toBeVisible();
  const denial = page
    .getByRole("alert")
    .filter({ hasText: "Platform access required" });
  await expect(denial).toContainText(
    "No company request information has been loaded.",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Linked Carer Browser Proof")).toHaveCount(0);
  await expect(page.getByText("admin@local.dev")).toHaveCount(0);

  await denial.getByRole("link", { name: "Return to Today" }).click();
  await expect(page).toHaveURL(/\/today$/);
});

test("a Platform Owner revokes the exact first Manager before cleanup and the same Manager session loses authority", async ({
  browser,
}) => {
  const managerContext = await browser.newContext({
    baseURL: "http://localhost:3004",
  });
  const managerPage = await managerContext.newPage();
  const managerToken = await activateSignedProfile(managerPage, "manager");
  await gotoAppRoute(managerPage, "/people");
  await expect(
    managerPage
      .getByRole("table")
      .getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  const operatorContext = await browser.newContext({
    baseURL: "http://localhost:3004",
  });
  const operatorPage = await operatorContext.newPage();
  const operatorToken = await activateSignedProfile(
    operatorPage,
    "platform_operator",
  );
  await gotoAppRoute(
    operatorPage,
    "/platform/company-requests?status=APPROVED",
  );
  await expect(
    operatorPage.getByRole("heading", { name: "Company access requests" }),
  ).toBeVisible();

  const company = operatorPage
    .getByRole("article")
    .filter({ hasText: "Linked Carer Browser Proof" });
  await expect(
    company.getByText("admin@local.dev", { exact: true }),
  ).toBeVisible();
  const revokeButton = company.getByRole("button", {
    name: "Revoke first Manager",
  });
  await revokeButton.click();
  const cancelledDialog = operatorPage.getByRole("dialog", {
    name: "Revoke access for admin@local.dev?",
  });
  await expect(cancelledDialog).toContainText(
    "This stops the first Manager's access to Linked Carer Browser Proof immediately.",
  );
  await expect(cancelledDialog).toContainText(
    "No replacement Manager will be created.",
  );
  await cancelledDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(revokeButton).toBeFocused();

  await revokeButton.click();
  const confirmedDialog = operatorPage.getByRole("dialog", {
    name: "Revoke access for admin@local.dev?",
  });
  await confirmedDialog
    .getByRole("button", { name: "Revoke first Manager", exact: true })
    .click();
  await expect(
    operatorPage.getByRole("status").filter({
      hasText:
        "First Manager access revoked for Linked Carer Browser Proof. Clerk cleanup still needs attention.",
    }),
  ).toBeVisible();
  await expect(
    operatorPage.getByRole("heading", { name: "Company access requests" }),
  ).toBeFocused();

  expect(managerToken).toContain(".");
  const deniedResponse = await managerPage.request.get("/api/access-context");
  expect(deniedResponse.status()).toBe(200);
  await expect(deniedResponse.json()).resolves.toMatchObject({
    membershipState: "INACTIVE",
    surface: "NONE",
    onboardingState: "BLOCKED",
    resolution: "DENIED",
  });
  await gotoAppRoute(managerPage, "/people");
  await expect(managerPage).toHaveURL(/\/access\/disabled$/);
  await expect(managerPage.getByText("Assigned Fake Client")).toHaveCount(0);

  await gotoAppRoute(
    operatorPage,
    "/platform/company-requests?status=DISABLED",
  );
  const disabledCompany = operatorPage
    .getByRole("article")
    .filter({ hasText: "Linked Carer Browser Proof" });
  await expect(
    disabledCompany.getByText("Cleanup needs attention"),
  ).toBeVisible();
  await expect(
    disabledCompany.getByText("Safe code: CLERK_MEMBERSHIP_BINDING_MISMATCH"),
  ).toBeVisible();
  await disabledCompany
    .getByRole("button", { name: "Retry Clerk cleanup" })
    .click();
  await expect(
    operatorPage.getByRole("status").filter({
      hasText:
        "Oasis access remains revoked for Linked Carer Browser Proof. Clerk cleanup still needs attention.",
    }),
  ).toBeVisible();
  await expect(
    disabledCompany.getByText("Cleanup needs attention"),
  ).toBeVisible();

  expect(operatorToken).toContain(".");
  await operatorContext.close();
  await managerContext.close();
});
