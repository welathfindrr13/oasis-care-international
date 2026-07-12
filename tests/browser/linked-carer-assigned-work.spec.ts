import { expect, test } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VISIT_ID = "55555555-5555-4555-8555-555555555555";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function signIn(
  page: import("playwright/test").Page,
  profile: { email: string; name: string; role: string; callbackUrl?: string },
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
    if (!authResponse.ok()) continue;
    for (let poll = 0; poll < 20; poll += 1) {
      const sessionResponse = await page.request.get("/api/auth/session");
      const session = sessionResponse.ok()
        ? ((await sessionResponse.json()) as { user?: { email?: string } })
        : null;
      if (
        session?.user?.email?.trim().toLowerCase() ===
        profile.email.trim().toLowerCase()
      ) {
        return;
      }
      await page.waitForTimeout(100);
    }
  }
  throw new Error(`Synthetic sign-in did not establish ${profile.email}`);
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
    callbackUrl: "http://localhost:3002/today",
  });

  await page.goto("/today");

  await expect(page).toHaveURL("/today");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("Next visit", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Workforce", exact: true }),
  ).toHaveCount(0);

  await expect(page.getByText("Assigned Fake Client", { exact: true })).toBeVisible();
  await expect(
    page.locator(`a[href="/schedule/${UNASSIGNED_VISIT_ID}"]`),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Open visit" }).click();

  await expect(page).toHaveURL(`/schedule/${VISIT_ID}`);
  await expect(page.getByRole("heading", { name: "Assigned Fake Client" })).toBeVisible();
  await expect(page.getByText("Browser Carer", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Visit details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Step 3. Medication support" })).toBeVisible();
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
  let releaseHeldSnapshot: (() => void) | null = null;
  let markHeldSnapshotStarted: (() => void) | null = null;
  let heldSnapshotStarted: Promise<void> | null = null;
  let heldSnapshot: Promise<void> | null = null;
  let holdNextSnapshot = false;

  function holdNextAccessSnapshot() {
    holdNextSnapshot = true;
    heldSnapshotStarted = new Promise<void>((resolve) => {
      markHeldSnapshotStarted = resolve;
    });
    heldSnapshot = new Promise<void>((resolve) => {
      releaseHeldSnapshot = resolve;
    });
  }

  await page.route("**/api/access-context", async (route) => {
    if (!holdNextSnapshot) {
      await route.continue();
      return;
    }
    holdNextSnapshot = false;
    markHeldSnapshotStarted?.();
    await heldSnapshot;
    await route.continue().catch(() => undefined);
  });

  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
  });
  await page.goto("/visits");
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  holdNextAccessSnapshot();
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
  });
  await refreshMountedNextAuthSession(page);
  await heldSnapshotStarted;
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Switching account")).toBeVisible();
  releaseHeldSnapshot?.();
  await expect(page).toHaveURL("/today");
  await expect(
    page.getByRole("link", { name: "Workforce", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toHaveCount(0);

  await signIn(page, {
    email: "family@local.dev",
    name: "Local Family",
    role: "user",
  });
  await refreshMountedNextAuthSession(page);
  await expect(page).toHaveURL("/family");
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Workforce", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);

  await expect(
    page.getByRole("heading", { name: "Stay up to date with their care" }),
  ).toBeVisible();
  await expect(page.getByText("A comfortable morning visit", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Family Assurance Room", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/proof-of-care/i)).toHaveCount(0);

  await page.getByRole("link", { name: "View updates" }).click();
  await expect(page).toHaveURL(`/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(page.getByRole("heading", { name: "Assigned Fake Client" })).toBeVisible();
  await expect(page.getByText("The morning visit went well and the planned support was completed.")).toBeVisible();
  await page.getByLabel("What is this about?").selectOption("WELLBEING_CHANGE");
  await page.getByLabel("How important is it?").selectOption("MEDIUM");
  await page.getByLabel("Short summary").fill("A question about today");
  await page.getByLabel("Tell us more (optional)").fill("Please call when someone is available.");
  await page.getByRole("button", { name: "Send concern to the care team" }).click();
  await expect(page.getByRole("heading", { name: "Your concern has been sent" })).toBeVisible();
  await expect(page.getByText(/The care team has received “A question about today”/)).toBeVisible();
});

test("manager, care manager, and office memberships stay outside admin and Carer workspaces", async ({
  page,
}) => {
  const profiles = [
    { email: "manager@local.dev", name: "Local Manager", workspace: "Manager workspace" },
    { email: "care-manager@local.dev", name: "Local Care Manager", workspace: "Care manager workspace" },
    { email: "office@local.dev", name: "Local Office", workspace: "Office workspace" },
  ];

  for (const profile of profiles) {
    await signIn(page, {
      email: profile.email,
      name: profile.name,
      role: "admin",
      callbackUrl: "http://localhost:3002/today",
    });
    await page.goto("/today");

    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByLabel(`Oasis Care, ${profile.workspace}`)).toBeVisible();
    await expect(page.getByText("Profile and settings access", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Workforce", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "My visits", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Updates", exact: true })).toHaveCount(0);
  }
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

test("pre-workspace invitation activation renders before membership resolution", async ({
  page,
}) => {
  await signIn(page, {
    email: "unlinked-invite@local.dev",
    name: "Unlinked Invite",
    role: "user",
    callbackUrl: "http://localhost:3002/activate-invitation",
  });

  await page.goto("/activate-invitation");

  await expect(page).toHaveURL("/activate-invitation");
  await expect(
    page.getByText(
      "Secure invitation activation is not available in this environment. No care information has been loaded.",
    ),
  ).toBeVisible();
});

test("the offline shell renders without waiting for session resolution", async ({
  page,
}) => {
  let releaseSession!: () => void;
  const heldSession = new Promise<void>((resolve) => {
    releaseSession = resolve;
  });
  await page.route("**/api/auth/session", async (route) => {
    await heldSession;
    await route.continue().catch(() => undefined);
  });

  await page.goto("/offline");

  await expect(
    page.getByRole("heading", { name: "You are offline" }),
  ).toBeVisible();
  await expect(
    page.getByText("Oasis Care needs an internet connection", { exact: false }),
  ).toBeVisible();
  releaseSession();
});

test("a signed-in family user can still open the public company access form", async ({
  page,
}) => {
  await signIn(page, {
    email: "family@local.dev",
    name: "Local Family",
    role: "user",
    callbackUrl: "http://localhost:3002/request-access",
  });

  await page.goto("/request-access");

  await expect(page).toHaveURL("/request-access");
  await expect(
    page.getByRole("heading", {
      name: "Request a review for your care company",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Care company name")).toBeVisible();
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
    page.getByRole("heading", { name: "Invite and manage access" }),
  ).toBeVisible();
  await expect(
    page.getByText("carer@local.dev", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("pending-carer@example.test", { exact: true }),
  ).toBeVisible();
  const expiredLifecycleRow = page
    .getByRole("row")
    .filter({ hasText: "expired-carer@example.test" });
  await expect(expiredLifecycleRow).toBeVisible();
  await expect(expiredLifecycleRow).toContainText("Expired");
  await expect(
    page.getByText("revoked-carer@example.test", { exact: true }),
  ).toBeVisible();
  const activeLifecycleRow = page
    .getByRole("row")
    .filter({ hasText: "carer@local.dev" });
  await expect(activeLifecycleRow).toContainText(
    "Active — ready for assignment",
  );
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

test("the workforce surface remains accessible at phone, tablet, and desktop sizes", async ({
  page,
}) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/admin/carers",
  });

  const viewports = [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ] as const;

  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize(viewport);
      await page.goto("/admin/carers");

      await expect(
        page.getByRole("heading", { name: "Carers and access" }),
      ).toBeVisible();
      const overflow = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .map((element) => {
            const bounds = element.getBoundingClientRect();
            return {
              className: element.className,
              left: Math.round(bounds.left),
              right: Math.round(bounds.right),
              tagName: element.tagName,
              text: element.textContent?.trim().slice(0, 80),
            };
          })
          .filter(
            ({ left, right }) => left < -1 || right > window.innerWidth + 1,
          )
          .slice(0, 20),
      }));
      expect(
        overflow.documentWidth,
        JSON.stringify(overflow.offenders, null, 2),
      ).toBeLessThanOrEqual(overflow.viewportWidth);

      if (viewport.width < 1280) {
        const navigationTrigger = page.getByRole("button", {
          name: "Open navigation",
        });
        await expect(navigationTrigger).toBeVisible();
        await navigationTrigger.click();
        const mobileNavigation = page.locator("#oasis-mobile-navigation");
        await expect(mobileNavigation).toBeVisible();
        await expect(
          mobileNavigation.getByRole("link", {
            name: "Workforce",
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByRole("button", { name: "Open navigation" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Workforce", exact: true }),
        ).toBeVisible();
      }

      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
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
  await expect(
    page.getByText("A new secure Carer invitation was sent."),
  ).toBeVisible();

  await page.getByLabel("Carer email").fill("pending-carer@example.test");
  await page.getByRole("button", { name: "Invite Carer" }).click();
  await expect(
    page.getByText("The secure Carer invitation was sent."),
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
  const activeRow = adminPage
    .getByRole("row")
    .filter({ hasText: "carer@local.dev" });
  await activeRow.getByRole("button", { name: "Deactivate" }).click();
  const confirmation = adminPage.getByRole("dialog", {
    name: "Deactivate Carer access?",
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Deactivate access" }).click();
  await expect(activeRow).toContainText("Revoked — access disabled");
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
