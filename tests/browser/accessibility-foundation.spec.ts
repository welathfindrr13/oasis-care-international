import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const VISIT_ID = "77777777-7777-4777-8777-777777777777";
const PERSON_ID = "88888888-8888-4888-8888-888888888888";
const CARE_ROOM_ID = "99999999-9999-4999-8999-999999999999";
const EMPTY_CONCERN_ROOM_ID = "13131313-1313-4131-8131-131313131313";
const UNAVAILABLE_CONCERN_ROOM_ID = "14141414-1414-4141-8141-141414141414";
const REVOKED_CONCERN_ROOM_ID = "15151515-1515-4151-8151-151515151515";
const ZERO_GRANT_CONCERN_ROOM_ID = "16161616-1616-4161-8161-161616161616";
const MAX_SEQUENTIAL_FOCUS_STEPS = 80;

type TestProfile = {
  email: string;
  name: string;
  role: "admin" | "carer" | "user";
};

const profiles: Record<"tenantAdmin" | "carer" | "family", TestProfile> = {
  tenantAdmin: {
    email: "tenant-admin-accessibility@local.dev",
    name: "Accessibility Tenant Admin",
    role: "admin",
  },
  carer: {
    email: "carer-accessibility@local.dev",
    name: "Accessibility Carer",
    role: "carer",
  },
  family: {
    email: "family-accessibility@local.dev",
    name: "Accessibility Family Member",
    role: "user",
  },
};

async function signIn(page: Page, profile: TestProfile) {
  const csrfResponse = await page.request.get("/api/auth/csrf");
  expect(csrfResponse.ok()).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
  const authResponse = await page.request.post(
    "/api/auth/callback/oasis-local",
    {
      form: {
        csrfToken,
        callbackUrl: "/access",
        email: profile.email,
        name: profile.name,
        role: profile.role,
        organizationId: "",
      },
    },
  );
  expect(authResponse.ok()).toBeTruthy();

  await expect
    .poll(async () => {
      const response = await page.request.get("/api/auth/session");
      const session = response.ok()
        ? ((await response.json()) as { user?: { email?: string } })
        : null;
      return session?.user?.email?.toLowerCase();
    })
    .toBe(profile.email.toLowerCase());
}

async function expectSequentialKeyboardTraversal(page: Page) {
  const focusableIds = await page.evaluate(() => {
    const selector = [
      "a[href]",
      "area[href]",
      "button",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "iframe",
      "[contenteditable]:not([contenteditable='false'])",
      "[tabindex]",
    ].join(",");

    return Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((element) => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return (
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[inert], [aria-hidden='true']") &&
          bounds.width > 0 &&
          bounds.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      })
      .map((element, index) => {
        const id = `accessibility-focus-${index}`;
        element.dataset.accessibilityFocusId = id;
        return id;
      });
  });

  expect(focusableIds.length).toBeGreaterThan(0);
  expect(focusableIds.length).toBeLessThanOrEqual(MAX_SEQUENTIAL_FOCUS_STEPS);

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
    window.scrollTo(0, 0);
  });

  const visited = new Set<string>();
  let firstFocusId: string | null = null;
  let completedCycle = false;

  for (let step = 0; step < focusableIds.length + 2; step += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) {
        return null;
      }
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return {
        id: element.dataset.accessibilityFocusId || null,
        visible:
          bounds.width > 0 &&
          bounds.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          !element.closest("[inert], [aria-hidden='true']"),
        focusVisible: element.matches(":focus-visible"),
        withinViewport:
          bounds.left >= 0 &&
          bounds.top >= 0 &&
          bounds.right <= window.innerWidth &&
          bounds.bottom <= window.innerHeight,
      };
    });

    if (!focus) continue;
    expect(focus.id).not.toBeNull();

    if (visited.has(focus.id as string)) {
      expect(focus.id).toBe(firstFocusId);
      completedCycle = true;
      break;
    }

    if (!firstFocusId) firstFocusId = focus.id;
    visited.add(focus.id as string);
    expect(focus.visible).toBe(true);
    expect(focus.focusVisible).toBe(true);
    expect(focus.withinViewport).toBe(true);
    await expect(page.locator(":focus")).toHaveAccessibleName(/\S/);
  }

  expect(visited.size).toBe(focusableIds.length);
  expect(completedCycle || visited.size === focusableIds.length).toBe(true);

  await page.evaluate(() => {
    document
      .querySelectorAll("[data-accessibility-focus-id]")
      .forEach((element) =>
        element.removeAttribute("data-accessibility-focus-id"),
      );
  });
}

async function expectMainContentBypass(page: Page) {
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
    window.scrollTo(0, 0);
  });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
}

async function expectAccessibilityFoundation(
  page: Page,
  options: {
    repeatedHeader?: boolean;
    sequentialKeyboardTraversal?: boolean;
  } = {},
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("h1:visible")).toHaveCount(1);

  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth);

  const positiveTabIndexes = await page
    .locator("[tabindex]")
    .evaluateAll((elements) =>
      elements
        .map((element) => Number(element.getAttribute("tabindex")))
        .filter((tabIndex) => Number.isFinite(tabIndex) && tabIndex > 0),
    );
  expect(positiveTabIndexes).toEqual([]);

  if (options.sequentialKeyboardTraversal !== false) {
    await expectSequentialKeyboardTraversal(page);
  }
  if (options.repeatedHeader) await expectMainContentBypass(page);

  const motion = await page.evaluate(() => ({
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    longRunningAnimations: document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return (
        animation.playState === "running" &&
        typeof timing?.duration === "number" &&
        timing.duration > 50
      );
    }).length,
  }));
  expect(motion.reduce).toBe(true);
  expect(motion.longRunningAnimations).toBe(0);

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const normalizedViolations = accessibility.violations.map((violation) => ({
    id: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")).sort(),
  }));
  expect(normalizedViolations).toEqual([]);
}

test("Public", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Clear care records, from plan to visit update",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Request company access" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Manager Today" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review family updates" }),
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("Login", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to Oasis Care" }),
  ).toBeVisible();
  const headingLevels = await page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );
  expect(headingLevels).toEqual([1, 2]);
  await expect(page.getByLabel("Workspace")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("Tenant admin Today", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Needs attention" }),
  ).toBeVisible();
  await expect(page.getByText("No visits scheduled today")).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Tenant admin company setup", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/admin/setup");
  await expect(page).toHaveURL(/\/admin\/setup$/);
  await expect(
    page.getByRole("heading", { name: "Set up your company" }),
  ).toBeVisible();
  await expect(
    page.getByText("Meadow Care Services", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add a client", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/must accept the invitation before you can assign/),
  ).toBeVisible();
  await expect(
    page.getByText(/synthetic|canary|fixture|seed|internal organization ID/i),
  ).toHaveCount(0);
  const primarySize = await page
    .getByRole("link", { name: "Add a client", exact: true })
    .first()
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
  expect(primarySize.height).toBeGreaterThanOrEqual(44);
  expect(primarySize.width).toBeGreaterThanOrEqual(44);
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Tenant admin client navigation keeps context and hides internal IDs", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/clients");
  await expect(page).toHaveURL(/\/clients$/);
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add client", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^ID:/)).toHaveCount(0);
  const compactNavigation = page.getByRole("button", {
    name: "Open navigation",
  });
  if (await compactNavigation.isVisible()) {
    await compactNavigation.click();
  }
  await expect(
    page.getByRole("link", { name: "Clients", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const closeNavigation = page.getByRole("button", {
    name: "Close navigation",
  });
  if (await closeNavigation.isVisible()) {
    await closeNavigation.click();
  }
  await expectAccessibilityFoundation(page, { repeatedHeader: true });

  await page.goto(`/clients/${PERSON_ID}`);
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Client details", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^ID:/)).toHaveCount(0);
  await expectAccessibilityFoundation(page, { repeatedHeader: true });

  await page.goto(`/care-planning?clientId=${PERSON_ID}`);
  await expect(page).toHaveURL(new RegExp(`clientId=${PERSON_ID}`));
  await expect(page.getByText("Jordan Ellis", { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Tenant admin client detail reflows at 320 CSS pixels", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone-390x844");
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page, profiles.tenantAdmin);
  await page.goto(`/clients/${PERSON_ID}`);
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Carer profile copy remains person-centred until route narrowing", async ({
  page,
}) => {
  await signIn(page, profiles.carer);
  await page.goto(`/clients/${PERSON_ID}`);
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Person details", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Care Notes" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Family access" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Care planning" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Inspection records" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Family Updates room" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "AI Health Summary" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Evidence packs" })).toHaveCount(0);
  await expect(page.getByText("Assessments", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Active care plan", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\bclient\b/i)).toHaveCount(0);
});

test("Platform Owner first Manager revocation is explicit and recoverable", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/platform/company-requests?status=APPROVED");
  await expect(
    page.getByRole("heading", { name: "Company access requests" }),
  ).toBeVisible();
  await expect(
    page.getByText("Meadow Care Services", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("manager@example.test", { exact: true }),
  ).toBeVisible();

  const revoke = page.getByRole("button", { name: "Revoke first Manager" });
  const revokeSize = await revoke.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(revokeSize.width).toBeGreaterThanOrEqual(44);
  expect(revokeSize.height).toBeGreaterThanOrEqual(44);

  await revoke.focus();
  await revoke.click();
  const dialog = page.getByRole("dialog", {
    name: "Revoke access for manager@example.test?",
  });
  await expect(dialog).toContainText(
    "This stops the first Manager's access to Meadow Care Services immediately.",
  );
  await expect(dialog).toContainText(
    "The company and care records will remain.",
  );
  await expect(dialog).toContainText("No replacement Manager will be created.");
  const dialogAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(dialogAccessibility.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(revoke).toBeFocused();

  await page.route("**/api/graphql", async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    if (payload.query?.includes("RevokeBootstrapManager")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          errors: [{ message: "Fixture revocation failure" }],
        }),
      });
      return;
    }
    await route.continue();
  });

  await revoke.click();
  await page
    .getByRole("dialog", { name: "Revoke access for manager@example.test?" })
    .getByRole("button", { name: "Revoke first Manager" })
    .click();
  const problem = page
    .getByRole("alert")
    .filter({ hasText: "We could not revoke this first Manager safely" });
  await expect(problem).toBeFocused();
  const problemLink = problem.getByRole("link", {
    name: /We could not revoke this first Manager safely/,
  });
  await expect(problemLink).toHaveAttribute(
    "href",
    "#bootstrap-manager-10101010-1010-4010-8010-101010101010",
  );
  await problemLink.click();
  await expect(
    page.locator("#bootstrap-manager-10101010-1010-4010-8010-101010101010"),
  ).toBeFocused();
  await expect(
    page.getByText("manager@example.test", { exact: true }),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, {
    sequentialKeyboardTraversal: false,
  });
});

test("Platform Owner cleanup attention remains truthful and retryable", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/platform/company-requests?status=DISABLED");
  await expect(
    page.getByText("Cleanup needs attention", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Safe code: CLERK_MEMBERSHIP_BINDING_MISMATCH"),
  ).toBeVisible();
  await expect(
    page.getByText(/No replacement Manager was created/),
  ).toBeVisible();

  await page.route("**/api/graphql", async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    if (payload.query?.includes("RevokeBootstrapManager")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            revokeBootstrapManagerAccess: {
              id: "10101010-1010-4010-8010-101010101010",
              companyName: "Meadow Care Services",
              contactName: "Avery Morgan",
              businessEmail: "avery@example.test",
              operationalNote: null,
              status: "DISABLED",
              organizationId: "org-accessibility-fixture",
              provisioningStatus: "ACTIVATED",
              provisioningAttemptCount: 1,
              provisioningErrorCode: null,
              bootstrapManagerEmail: "manager@example.test",
              bootstrapManagerAccessStatus: "REVOKED",
              bootstrapManagerCleanupStatus: "NEEDS_ATTENTION",
              bootstrapManagerCleanupErrorCode:
                "CLERK_MEMBERSHIP_BINDING_MISMATCH",
              requestedAt: "2026-07-18T09:00:00.000Z",
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  const retry = page.getByRole("button", { name: "Retry Clerk cleanup" });
  const retrySize = await retry.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(retrySize.width).toBeGreaterThanOrEqual(44);
  expect(retrySize.height).toBeGreaterThanOrEqual(44);
  await retry.click();
  await expect(
    page.getByRole("status").filter({
      hasText:
        "Oasis access remains revoked for Meadow Care Services. Clerk cleanup still needs attention.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Cleanup needs attention", { exact: true }),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, {
    sequentialKeyboardTraversal: false,
  });

  await page.setViewportSize({ width: 320, height: 844 });
  const reflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(reflow.documentWidth).toBeLessThanOrEqual(reflow.viewportWidth);
});

test("Tenant admin manages Family access from the selected person", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto(`/clients/${PERSON_ID}/carebridge`);
  await expect(page).toHaveURL(new RegExp(`/clients/${PERSON_ID}/carebridge$`));
  await expect(
    page.getByRole("heading", { name: "Family access for Jordan Ellis" }),
  ).toBeVisible();
  await expect(
    page.getByText("Invitations begin with no access."),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Approved care updates/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Send concerns/ }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  const problem = page
    .getByRole("alert")
    .filter({ hasText: "There is a problem" });
  await expect(problem).toBeFocused();
  await expect(
    problem.getByRole("link", { name: "Enter the family member’s name." }),
  ).toHaveAttribute("href", "#family-fullName");
  await expect(
    problem.getByRole("link", { name: "Enter a valid email address." }),
  ).toHaveAttribute("href", "#family-email");

  const resend = page.getByRole("button", { name: "Resend invitation" });
  await resend.focus();
  await resend.click();
  await expect(
    page.getByRole("dialog", { name: "Resend invitation to Alex Ellis?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(resend).toBeFocused();

  const undersized = await page
    .locator("button, input:not([type=checkbox]), select, textarea")
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const bounds = control.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            (bounds.width < 44 || bounds.height < 44)
          );
        })
        .map((control) => ({
          tag: control.tagName,
          text: control.textContent,
        })),
    );
  expect(undersized).toEqual([]);
  const checkboxTargets = await page
    .getByRole("checkbox")
    .evaluateAll((checkboxes) =>
      checkboxes.map((checkbox) => {
        const label = checkbox.closest("label");
        const bounds = label?.getBoundingClientRect();
        return { width: bounds?.width || 0, height: bounds?.height || 0 };
      }),
    );
  expect(
    checkboxTargets.every(
      (target) => target.width >= 44 && target.height >= 44,
    ),
  ).toBe(true);

  await expectAccessibilityFoundation(page, { repeatedHeader: true });
  await page.setViewportSize({ width: 320, height: 844 });
  const reflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(reflow.documentWidth).toBeLessThanOrEqual(reflow.viewportWidth);
});

test("Tenant admin receives truthful Family delivery and linked operation errors", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto(`/clients/${PERSON_ID}/carebridge`);

  await page.route("**/api/graphql", async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    if (payload.query?.includes("InviteFamilyContact")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            inviteFamilyContact: {
              id: "12121212-1212-4121-8121-121212121212",
              invitationId: "34343434-3434-4343-8343-343434343434",
              role: "FAMILY_VIEWER",
              status: "INVITED",
              accessBasis: "PROVIDER_AUTHORISED",
              reviewDueAt: null,
              familyContact: {
                id: "56565656-5656-4565-8565-565656565656",
                fullName: "Casey Ellis",
                email: "casey@example.test",
                relationship: null,
              },
              accessGrants: [],
              invitationStatus: "PENDING",
              deliveryStatus: "RETRYABLE",
              cleanupStatus: "COMPLETE",
              invitationExpiresAt: "2026-07-25T09:00:00.000Z",
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByLabel("Full name").fill("Casey Ellis");
  await page.getByLabel("Email address").fill("casey@example.test");
  await page
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();

  const deliveryProblem = page
    .getByRole("alert")
    .filter({ hasText: "invitation email was not delivered" });
  await expect(deliveryProblem).toBeFocused();
  await expect(page.getByText(/Invitation sent to Casey Ellis/)).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Retry delivery" });
  const deliveryLink = deliveryProblem.getByRole("link", {
    name: /invitation email was not delivered/,
  });
  await expect(deliveryLink).toHaveAttribute(
    "href",
    "#family-retry-12121212-1212-4121-8121-121212121212",
  );
  await deliveryLink.click();
  await expect(retry).toBeFocused();
});

test("Tenant admin keeps grant choices and focus through failed and confirmed actions", async ({
  page,
}) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto(`/clients/${PERSON_ID}/carebridge`);

  await page.route("**/api/graphql", async (route) => {
    const payload = route.request().postDataJSON() as { query?: string };
    if (payload.query?.includes("UpdateFamilyAccessGrants")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          errors: [{ message: "Fixture grant failure" }],
        }),
      });
      return;
    }
    if (payload.query?.includes("RevokeFamilyAccess")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            revokeFamilyAccess: {
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              invitationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              role: "FAMILY_VIEWER",
              status: "REVOKED",
              accessBasis: "PROVIDER_AUTHORISED",
              reviewDueAt: null,
              familyContact: {
                id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
                fullName: "Morgan Ellis",
                email: "morgan@example.test",
                relationship: "Son",
              },
              accessGrants: [],
              invitationStatus: "ACCEPTED",
              deliveryStatus: "DELIVERED",
              cleanupStatus: "COMPLETE",
              invitationExpiresAt: "2026-07-25T09:00:00.000Z",
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  const concerns = page.getByRole("checkbox", { name: /Send concerns/ });
  await concerns.check();
  await page.getByRole("button", { name: "Save sharing choices" }).click();
  const grantProblem = page
    .getByRole("alert")
    .filter({ hasText: "sharing choices" });
  await expect(grantProblem).toBeFocused();
  await expect(concerns).toBeChecked();
  const grantLink = grantProblem.getByRole("link", { name: /sharing choices/ });
  await expect(grantLink).toHaveAttribute(
    "href",
    "#family-grants-dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  );
  await grantLink.click();
  await expect(
    page.locator("#family-grants-dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
  ).toBeFocused();
  await expect(concerns).toBeChecked();

  await page.getByRole("button", { name: "Revoke access" }).click();
  await page
    .getByRole("dialog", { name: "Revoke access for Morgan Ellis?" })
    .getByRole("button", { name: "Revoke access" })
    .click();
  await expect(page.locator("#family-members-heading")).toBeFocused();
  await expect(
    page.getByText("Access revoked for Morgan Ellis."),
  ).toBeVisible();
});

for (const route of ["/emar", "/medication"]) {
  test(`Tenant admin ${route} is safely excluded`, async ({ page }) => {
    await signIn(page, profiles.tenantAdmin);
    await page.goto(route);
    await expect(page).toHaveURL(/\/access\/feature-not-enabled$/);
    await expect(
      page.getByRole("heading", {
        name: "Medication and eMAR are not available",
      }),
    ).toBeVisible();
    await expectAccessibilityFoundation(page);
  });
}

test("Carer Today", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No visits assigned today" }),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("visit detail", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto(`/visits/${VISIT_ID}`);
  await expect(page).toHaveURL(new RegExp(`/visits/${VISIT_ID}$`));
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visit details" }),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Family home", async ({ page }) => {
  await signIn(page, profiles.family);
  await page.goto("/family");
  await expect(page).toHaveURL(/\/family$/);
  await expect(
    page.getByRole("heading", { name: "Stay up to date with their care" }),
  ).toBeVisible();
  await expect(
    page.getByText("You do not have access to anyone’s updates yet."),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Family concern status", async ({ page }) => {
  await signIn(page, profiles.family);
  await page.goto(`/family/care-rooms/${CARE_ROOM_ID}`);
  await expect(page).toHaveURL(
    new RegExp(`/family/care-rooms/${CARE_ROOM_ID}$`),
  );
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your concerns", exact: true }),
  ).toBeVisible();
  const concern = page.getByRole("article").filter({
    hasText:
      "Please review this clearly fictional family concern with a deliberately long title",
  });
  await expect(
    concern.getByText("Acknowledged", { exact: true }).first(),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });

  await page.goto(`/family/care-rooms/${EMPTY_CONCERN_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "No concerns sent", exact: true }),
  ).toBeVisible();

  await page.goto(`/family/care-rooms/${ZERO_GRANT_CONCERN_ROOM_ID}`);
  await expect(
    page.getByRole("heading", {
      name: "Concern access is not available",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto(`/family/care-rooms/${UNAVAILABLE_CONCERN_ROOM_ID}`);
  await expect(
    page.getByRole("heading", {
      name: "Concern statuses are temporarily unavailable",
      exact: true,
    }),
  ).toBeVisible();

  await page.goto(`/family/care-rooms/${REVOKED_CONCERN_ROOM_ID}`);
  await expect(
    page.getByRole("heading", { name: "Updates unavailable", exact: true }),
  ).toBeVisible();
  const revokedHeadingLevels = await page
    .locator("h1:visible, h2:visible, h3:visible")
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
  );
  expect(revokedHeadingLevels).toEqual([1, 2]);
  const revokedSkipLink = page.getByRole("link", {
    name: "Skip to main content",
  });
  await revokedSkipLink.focus();
  await expect(revokedSkipLink).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
  await expectAccessibilityFoundation(page, {
    sequentialKeyboardTraversal: false,
  });

  await page.goto(`/family/care-rooms/${CARE_ROOM_ID}`);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(
    page.getByRole("button", { name: "Send concern to the care team" }),
  ).toBeVisible();
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(pageOverflow).toBe(false);
});

test("Tenant admin family concerns", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/family-updates/concerns");
  await expect(page).toHaveURL(/\/family-updates\/concerns$/);
  await expect(
    page.getByRole("heading", {
      name: "Work family concerns from one operational queue",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No concerns in this view" }),
  ).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});
