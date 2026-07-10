import { expect, test } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VISIT_ID = "55555555-5555-4555-8555-555555555555";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";

async function signIn(
  page: import("playwright/test").Page,
  profile: { email: string; name: string; role: string; callbackUrl?: string },
) {
  const csrfResponse = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfResponse.json();
  const authResponse = await page.request.post(
    "/api/auth/callback/oasis-local",
    {
      form: {
        csrfToken,
        callbackUrl: profile.callbackUrl || "http://localhost:3002/access",
        email: profile.email,
        name: profile.name,
        role: profile.role,
        organizationId: "",
      },
    },
  );
  expect(authResponse.ok()).toBe(true);
}

async function refreshMountedNextAuthSession(
  page: import("playwright/test").Page,
) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "nextauth.message",
        newValue: JSON.stringify({
          event: "session",
          data: { trigger: "getSession" },
          timestamp: Math.floor(Date.now() / 1000),
        }),
      }),
    );
  });
}

test("a linked fake carer follows the database role despite an admin token claim", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
    callbackUrl: "http://localhost:3002/visits",
  });

  await page.goto("/visits");

  await expect(page).toHaveURL("/visits");
  await expect(page.getByRole("link", { name: "Management" })).toHaveCount(0);

  const assignedVisit = page.locator(`a[href="/schedule/${VISIT_ID}"]`);
  await expect(assignedVisit).toHaveCount(1);
  await expect(
    page.locator(`a[href="/schedule/${UNASSIGNED_VISIT_ID}"]`),
  ).toHaveCount(0);
  await assignedVisit.click();

  await expect(page).toHaveURL(`/schedule/${VISIT_ID}`);
  await expect(page.getByRole("heading", { name: "Care Visit" })).toBeVisible();
  await expect(page.getByText("Browser Carer", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Confirm assigned visit", { exact: true }),
  ).toBeVisible();

  const startVisit = page.getByRole("button", { name: "Start visit" });
  await expect(startVisit).toBeEnabled();
  await startVisit.click();

  await expect(page.getByText("Visit started.", { exact: true })).toBeVisible();
  await expect(page.getByText("in progress", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Mark done" })).toBeEnabled();
});

test("account switching clears stale capabilities and follows each database membership", async ({
  page,
}) => {
  let releaseOldSnapshot!: () => void;
  let markOldSnapshotStarted!: () => void;
  const oldSnapshotStarted = new Promise<void>((resolve) => {
    markOldSnapshotStarted = resolve;
  });
  const holdOldSnapshot = new Promise<void>((resolve) => {
    releaseOldSnapshot = resolve;
  });
  let holdNextSnapshot = true;
  await page.route("**/api/access-context", async (route) => {
    if (!holdNextSnapshot) {
      await route.continue();
      return;
    }
    holdNextSnapshot = false;
    markOldSnapshotStarted();
    await holdOldSnapshot;
    await route.continue().catch(() => undefined);
  });

  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
  });
  await page.goto("/visits");
  await oldSnapshotStarted;
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
  });
  await refreshMountedNextAuthSession(page);
  await expect(page).toHaveURL("/today");
  releaseOldSnapshot();
  await expect(page.getByRole("link", { name: "Management" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Family Assurance" }),
  ).toHaveCount(0);

  await signIn(page, {
    email: "family@local.dev",
    name: "Local Family",
    role: "user",
  });
  await refreshMountedNextAuthSession(page);
  await expect(page).toHaveURL("/family");
  await expect(
    page.getByRole("link", { name: "Family Assurance", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Management" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
});

test("an administrator sees the real organization in the guided synthetic setup", async ({
  page,
}) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/admin/setup",
  });

  await page.goto("/admin/setup");

  await expect(page).toHaveURL("/admin/setup");
  await expect(
    page.getByRole("heading", { name: "Prepare your Oasis workspace" }),
  ).toBeVisible();
  await expect(
    page.getByText("Linked Carer Browser Proof", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("org-browser-linked-carer", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Billing is not part of this setup.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add synthetic person →" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Schedule visit →" }),
  ).toBeVisible();
});

test("an administrator sees lifecycle readiness and only identity-valid Carers are assignable", async ({
  page,
}) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/admin/carers",
  });

  await page.goto("/admin/carers");
  await expect(
    page.getByRole("heading", { name: "Carer access lifecycle" }),
  ).toBeVisible();
  await expect(
    page.getByText("carer@local.dev", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("pending-carer@example.test", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Expired", { exact: true })).toBeVisible();
  await expect(
    page.getByText("revoked-carer@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Active · Ready for assignment", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Browser Carer", { exact: true })).toBeVisible();
  await expect(page.getByText("Other Carer", { exact: true })).toHaveCount(0);

  const accessibility = await new AxeBuilder({ page })
    .include('[data-testid="carer-lifecycle-panel"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goto("/visits/new");
  await expect(
    page.getByLabel("Carer *").locator("option", { hasText: "Browser Carer" }),
  ).toHaveCount(1);
  await expect(page.locator("option", { hasText: "Other Carer" })).toHaveCount(
    0,
  );
});

test("the lifecycle UI handles duplicate and expired invitation actions with stable IDs", async ({
  page,
}) => {
  await page.route("**/api/access-context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        organizationId: "org-browser-linked-carer",
        effectiveRole: "admin",
        membershipState: "ACTIVE",
        surface: "ADMIN",
        linkedIdentityState: "NOT_REQUIRED",
        onboardingState: "READY",
        resolution: "READY",
      }),
    });
  });
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/admin/carers",
  });
  await page.goto("/admin/carers");

  await page.route("**/api/graphql", async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    const base = {
      membershipId: null,
      carerId: null,
      status: "PENDING",
      readiness: "AWAITING_ACCEPTANCE",
      deliveryStatus: "DELIVERED",
      cleanupStatus: "COMPLETE",
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      canRevoke: true,
      canReissue: false,
      canRetryDelivery: false,
      canLink: false,
      canDeactivate: false,
    };
    if (payload.query?.includes("ReissueCarerInvitation")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            reissueCarerInvitation: {
              ...base,
              lifecycleId: "invitation:ffffffff-ffff-4fff-8fff-ffffffffffff",
              invitationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              emailAddress: "expired-carer@example.test",
            },
          },
        }),
      });
      return;
    }
    if (payload.query?.includes("InviteCarer")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            inviteCarer: {
              ...base,
              lifecycleId: "invitation:cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              invitationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              emailAddress: "pending-carer@example.test",
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  const expiredRow = page
    .getByRole("row")
    .filter({ hasText: "expired-carer@example.test" });
  await expiredRow.getByRole("button", { name: "Send new invitation" }).click();
  await expect(page.getByText("Carer access was updated.")).toBeVisible();

  await page.getByLabel("Carer email").fill("pending-carer@example.test");
  await page.getByRole("button", { name: "Invite Carer" }).click();
  await expect(
    page.getByText("The secure Carer invitation is ready."),
  ).toBeVisible();
  await expect(
    page.getByText("pending-carer@example.test", { exact: true }),
  ).toHaveCount(1);
});

test("deactivation immediately denies a previously signed-in Carer", async ({
  page,
  browser,
}) => {
  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
  });
  await page.goto("/visits");
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  const adminContext = await browser.newContext({
    baseURL: "http://localhost:3002",
  });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/admin/carers",
  });
  await adminPage.goto("/admin/carers");
  adminPage.once("dialog", (dialog) => dialog.accept());
  const activeRow = adminPage
    .getByRole("row")
    .filter({ hasText: "carer@local.dev" });
  await activeRow.getByRole("button", { name: "Deactivate" }).click();
  await expect(activeRow.getByText("Revoked · Access disabled")).toBeVisible();
  await adminContext.close();

  const revokedContext = await browser.newContext({
    baseURL: "http://localhost:3002",
  });
  const revokedPage = await revokedContext.newPage();
  await signIn(revokedPage, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
    callbackUrl: "http://localhost:3002/access",
  });
  await revokedPage.goto("/access").catch(() => undefined);
  await expect(revokedPage).toHaveURL(/\/access\/disabled$/);
  await expect(
    revokedPage.getByText("No care information has been loaded."),
  ).toBeVisible();
  await revokedContext.close();
});
