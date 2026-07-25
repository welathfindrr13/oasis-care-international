import { expect, test } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ORGANIZATION_ID = "org-browser-linked-carer";
const VISIT_ID = "55555555-5555-4555-8555-555555555555";
const UNASSIGNED_VISIT_ID = "55555555-5555-4555-8555-666666666666";
const CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SENTINEL_CLIENT_ID = "client-browser-sentinel";
const SENTINEL_CARE_ROOM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb";
const SENTINEL_VISIT_ID = "55555555-5555-4555-8555-888888888888";

async function signIn(
  page: import("playwright/test").Page,
  profile: {
    email: string;
    name: string;
    role: string;
    callbackUrl?: string;
    organizationId?: string;
  },
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
          organizationId: profile.organizationId ?? ORGANIZATION_ID,
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

test("an administrator creates a person and schedules an accepted Carer", async ({
  page,
}) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/people/new",
  });

  await page.goto("/people/new");
  await expect(page.getByRole("heading", { name: "Add person" })).toBeVisible();
  await page.getByLabel("Full Name *").fill("Browser Journey Person");
  await page.getByLabel("Address Line 1 *").fill("18 Acceptance Lane");
  await page.getByLabel("City *").fill("Leeds");
  await page.getByLabel("Postcode *").fill("LS1 2AB");
  await page.getByLabel(/I confirm that the person has been informed/).check();
  await page.getByRole("button", { name: "Create person" }).click();

  await expect(page).toHaveURL(/\/people$/);
  const personRow = page.getByRole("row").filter({
    hasText: "Browser Journey Person",
  });
  await expect(personRow).toContainText("18 Acceptance Lane");
  await personRow.getByRole("link", { name: "Schedule" }).click();

  await expect(page).toHaveURL(/\/visits\/new\?clientId=/);
  await expect(page.getByLabel("Person *")).toHaveValue(/.+/);
  await expect(
    page.getByLabel("Person *").locator("option:checked"),
  ).toHaveText(/Browser Journey Person/);
  await page.getByLabel("Carer *").selectOption({ label: "Browser Carer" });
  const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  futureStart.setUTCHours(10, 0, 0, 0);
  const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000);
  await page
    .getByLabel("Start Time *")
    .fill(futureStart.toISOString().slice(0, 16));
  await page
    .getByLabel("End Time *")
    .fill(futureEnd.toISOString().slice(0, 16));
  await page
    .getByLabel("Visit Notes")
    .fill("Browser journey scheduled after Carer acceptance");
  await page.getByRole("button", { name: "Schedule Visit" }).click();

  await expect(page).toHaveURL(/\/schedule\?clientId=/);
  const visitRow = page.getByRole("row").filter({
    hasText: "Browser Journey Person",
  });
  await expect(visitRow).toContainText("Browser Carer");
  await expect(visitRow).toContainText("Scheduled");
});

test("a linked fake carer follows the database role despite an admin token claim", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to Oasis Care" }),
  ).toBeVisible();

  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
    callbackUrl: "http://localhost:3002/today",
  });

  await page.goto("/today");

  await expect(page).toHaveURL("/today");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Next visit", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Workforce", exact: true }),
  ).toHaveCount(0);

  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/schedule/${UNASSIGNED_VISIT_ID}"]`),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Open visit" }).click();

  await expect(page).toHaveURL(`/schedule/${VISIT_ID}`);
  await expect(
    page.getByRole("heading", { name: "Assigned Fake Client" }),
  ).toBeVisible();
  await expect(page.getByText("Browser Carer", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Visit details" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Step 3. Care notes" }),
  ).toBeVisible();
  const visibleWorkspaceText = await page
    .locator("main")
    .evaluate((workspace) => {
      const textWalker = document.createTreeWalker(
        workspace,
        NodeFilter.SHOW_TEXT,
      );
      const visibleText: string[] = [];
      let textNode = textWalker.nextNode();

      while (textNode) {
        const parent = textNode.parentElement;
        const text = textNode.textContent?.trim();
        if (
          parent &&
          text &&
          !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parent.tagName)
        ) {
          const style = window.getComputedStyle(parent);
          const range = document.createRange();
          range.selectNodeContents(textNode);
          if (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            range.getClientRects().length > 0
          ) {
            visibleText.push(text);
          }
        }
        textNode = textWalker.nextNode();
      }

      return visibleText.join(" ");
    });
  expect(visibleWorkspaceText).not.toMatch(/medication|eMAR/i);

  const launchExcludedRoles = [
    "link",
    "button",
    "heading",
    "option",
    "checkbox",
    "radio",
    "tab",
    "menuitem",
    "textbox",
    "combobox",
    "switch",
  ] as const;
  for (const role of launchExcludedRoles) {
    await expect(
      page.getByRole(role, { name: /medication|eMAR/i }),
    ).toHaveCount(0);
  }
  await expect(page.getByLabel(/medication|eMAR/i)).toHaveCount(0);
  await expect(page.getByPlaceholder(/medication|eMAR/i)).toHaveCount(0);
  await expect(
    page.getByText("Confirm assigned visit", { exact: true }),
  ).toBeVisible();

  const startVisit = page.getByRole("button", { name: "Start visit" });
  await expect(startVisit).toBeEnabled();
  await startVisit.click();

  await expect(page.getByText("Visit started.", { exact: true })).toBeVisible();
  await expect(page.getByText("in progress", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Mark done" })).toBeEnabled();

  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(
    page.getByText("Care action marked done.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Done", { exact: true })).toBeVisible();

  await page
    .getByPlaceholder(
      "Record care delivered, person response, and any handover details.",
    )
    .fill("Browser journey care note recorded by the assigned Carer.");
  await page.getByRole("button", { name: "Record care note" }).click();
  await expect(
    page.getByText("Care note recorded.", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Recent care notes" })
      .locator("..")
      .getByText("Browser journey care note recorded by the assigned Carer.", {
        exact: true,
      }),
  ).toBeVisible();

  await page
    .getByPlaceholder("Add optional handover details for completion.")
    .fill("Browser journey completed with planned care delivered.");
  const completionDialog = page.waitForEvent("dialog");
  const completionClick = page
    .getByRole("button", { name: "Complete visit" })
    .click();
  const dialog = await completionDialog;
  expect(dialog.type()).toBe("confirm");
  expect(dialog.message()).toBe(
    "Complete the visit for Assigned Fake Client? Care notes will become read-only.",
  );
  await dialog.accept();
  await completionClick;
  await expect(
    page.getByText("Visit completed.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("completed", { exact: true })).toHaveCount(2);

  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: `http://localhost:3002/schedule/${VISIT_ID}`,
  });
  await page.goto(`/schedule/${VISIT_ID}`);
  await expect(
    page.getByRole("heading", { name: "Admin visit oversight" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Recent care notes" })
      .locator("..")
      .getByText("Browser journey care note recorded by the assigned Carer.", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(page.getByText(/Recorded note:/)).toContainText(
    "Browser journey completed with planned care delivered.",
  );
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
  await expect(
    page.getByText("A comfortable morning visit", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Family Assurance Room", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/proof-of-care/i)).toHaveCount(0);

  await page.getByRole("link", { name: "View updates" }).click();
  await expect(page).toHaveURL(`/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "Assigned Fake Client" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The morning visit went well and the planned support was completed.",
    ),
  ).toBeVisible();
  await page.getByLabel("What is this about?").selectOption("WELLBEING_CHANGE");
  await page.getByLabel("How important is it?").selectOption("MEDIUM");
  await page.getByLabel("Short summary").fill("A question about today");
  await page
    .getByLabel("Tell us more (optional)")
    .fill("Please call when someone is available.");
  await page
    .getByRole("button", { name: "Send concern to the care team" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your concern has been sent" }),
  ).toBeVisible();
  await expect(
    page.getByText(/The care team has received “A question about today”/),
  ).toBeVisible();
});

test("manager, care manager, and office memberships stay outside admin and Carer workspaces", async ({
  page,
}) => {
  const profiles = [
    {
      email: "manager@local.dev",
      name: "Local Manager",
      workspace: "Manager workspace",
    },
    {
      email: "care-manager@local.dev",
      name: "Local Care Manager",
      workspace: "Care manager workspace",
    },
    {
      email: "office@local.dev",
      name: "Local Office",
      workspace: "Office workspace",
    },
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
    await expect(
      page.getByLabel(`Oasis Care, ${profile.workspace}`),
    ).toBeVisible();
    await expect(
      page.getByText("Profile and settings access", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Workforce", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "My visits", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Updates", exact: true }),
    ).toHaveCount(0);
  }
});

test("an administrator sees the real company journey without internal setup language", async ({
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
    page.getByRole("heading", { name: "Set up your company" }),
  ).toBeVisible();
  await expect(
    page.getByText("Linked Carer Browser Proof", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("org-browser-linked-carer", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/synthetic|canary|fixture|seed|billing/i),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Add a person", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Invite a carer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Schedule a visit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View people", exact: true }),
  ).toBeVisible();
});

test("Admin Today prioritizes visit exceptions at mobile and desktop sizes", async ({
  page,
}, testInfo) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/today",
  });

  for (const viewport of [
    { width: 390, height: 844, name: "mobile" },
    { width: 1440, height: 900, name: "desktop" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/today");
    await expect(page).toHaveURL("/today");
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open today's schedule" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Needs attention" }),
    ).toBeVisible();
    await expect(
      page.getByText("Late or missed visits", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Assignments not ready", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Incomplete visit records", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("AI Health Summaries", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Care plan reviews due soon", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Medication exceptions", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Review visits assigned to a Carer whose account is not ready.",
      ),
    ).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`admin-today-${viewport.name}.png`),
      fullPage: true,
    });
  }
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
        medicationEmarEnabled: false,
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

test("tenant and family room guessing stays isolated", async ({ page }) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
  });
  await page.goto(`/people/${SENTINEL_CLIENT_ID}`);
  await expect(
    page.getByRole("heading", {
      name: /Person Not Found|Unable to Load Person/,
    }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);

  await signIn(page, {
    email: "carer@local.dev",
    name: "Local Carer",
    role: "admin",
  });
  await page.goto(`/schedule/${SENTINEL_VISIT_ID}`);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /not found|do not have access/i,
  );
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);

  await signIn(page, {
    email: "family@local.dev",
    name: "Local Family",
    role: "user",
  });
  await page.goto(`/family/care-rooms/${SENTINEL_CARE_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "Updates unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);

  await page.goto("/family/care-rooms/aaaaaaaa-aaaa-4aaa-8aaa-cccccccccccc");
  await expect(
    page.getByRole("heading", { name: "Updates unavailable", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("TEST ONLY Sentinel Person")).toHaveCount(0);
});

test("an unauthorized family identity receives zero rooms and sanitized denial", async ({
  page,
}) => {
  await signIn(page, {
    email: "unauthorized-family@local.dev",
    name: "Unauthorized Family",
    role: "user",
    callbackUrl: "http://localhost:3002/family",
  });
  await page.goto("/family");
  await expect(
    page.getByText(/You do not have access to anyone’s updates yet\./),
  ).toBeVisible();
  await expect(page.getByText("Assigned Fake Client")).toHaveCount(0);

  await page.goto(`/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: /Updates (?:temporarily )?unavailable/ }),
  ).toBeVisible();
  await expect(page.getByText("Assigned Fake Client")).toHaveCount(0);
});

test("a revoked family identity immediately loses room access", async ({
  page,
}) => {
  await signIn(page, {
    email: "revoked-family@local.dev",
    name: "Revoked Family",
    role: "user",
    callbackUrl: "http://localhost:3002/family",
  });
  await page.goto(`/family/care-rooms/${CARE_ROOM_ID}`);

  await expect(page).toHaveURL(/\/access\/unavailable$/);
  await expect(
    page.getByText("No care information has been loaded."),
  ).toBeVisible();
  await expect(page.getByText("Assigned Fake Client")).toHaveCount(0);
});

test("sign-out, Back, and refresh do not reveal protected content", async ({
  page,
}) => {
  await signIn(page, {
    email: "admin@local.dev",
    name: "Local Admin",
    role: "user",
    callbackUrl: "http://localhost:3002/people",
  });
  await page.goto("/people");
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toHaveCount(0);

  await page.goBack();
  await expect(page).not.toHaveURL(/\/people(?:\?|$)/);
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toHaveCount(0);

  await page.goto("/people");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.reload();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(
    page.getByText("Assigned Fake Client", { exact: true }),
  ).toHaveCount(0);
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
