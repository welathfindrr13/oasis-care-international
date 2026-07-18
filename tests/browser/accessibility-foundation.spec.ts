import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const VISIT_ID = "77777777-7777-4777-8777-777777777777";
const PERSON_ID = "88888888-8888-4888-8888-888888888888";
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
      .forEach((element) => element.removeAttribute("data-accessibility-focus-id"));
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
  options: { repeatedHeader?: boolean } = {},
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

  await expectSequentialKeyboardTraversal(page);
  if (options.repeatedHeader) await expectMainContentBypass(page);

  const motion = await page.evaluate(() => ({
    reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    longRunningAnimations: document
      .getAnimations()
      .filter((animation) => {
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
  await expect(page.getByRole("link", { name: "Open Manager Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Review family updates" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("Login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Oasis Care" })).toBeVisible();
  const headingLevels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((headings) =>
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
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByText("No visits scheduled today")).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Tenant admin company setup", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/admin/setup");
  await expect(page).toHaveURL(/\/admin\/setup$/);
  await expect(page.getByRole("heading", { name: "Set up your company" })).toBeVisible();
  await expect(page.getByText("Meadow Care Services", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add a person", exact: true }).first()).toBeVisible();
  await expect(page.getByText(/must accept the invitation before you can assign/)).toBeVisible();
  await expect(page.getByText(/synthetic|canary|fixture|seed|internal organization ID/i)).toHaveCount(0);
  const primarySize = await page.getByRole("link", { name: "Add a person", exact: true }).first().evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(primarySize.height).toBeGreaterThanOrEqual(44);
  expect(primarySize.width).toBeGreaterThanOrEqual(44);
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Tenant admin manages Family access from the selected person", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto(`/clients/${PERSON_ID}/carebridge`);
  await expect(page).toHaveURL(new RegExp(`/clients/${PERSON_ID}/carebridge$`));
  await expect(page.getByRole("heading", { name: "Family access for Jordan Ellis" })).toBeVisible();
  await expect(page.getByText("Invitations begin with no access.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Approved care updates/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Send concerns/ })).toBeVisible();

  await page.getByRole("button", { name: "Send invitation", exact: true }).click();
  const problem = page.getByRole("alert").filter({ hasText: "There is a problem" });
  await expect(problem).toBeFocused();
  await expect(problem.getByRole("link", { name: "Enter the family member’s name." })).toHaveAttribute("href", "#family-fullName");
  await expect(problem.getByRole("link", { name: "Enter a valid email address." })).toHaveAttribute("href", "#family-email");

  const resend = page.getByRole("button", { name: "Resend invitation" });
  await resend.focus();
  await resend.click();
  await expect(page.getByRole("dialog", { name: "Resend invitation to Alex Ellis?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(resend).toBeFocused();

  const undersized = await page.locator("button, input:not([type=checkbox]), select, textarea").evaluateAll((controls) =>
    controls.filter((control) => {
      const bounds = control.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && (bounds.width < 44 || bounds.height < 44);
    }).map((control) => ({ tag: control.tagName, text: control.textContent })),
  );
  expect(undersized).toEqual([]);
  const checkboxTargets = await page.getByRole("checkbox").evaluateAll((checkboxes) =>
    checkboxes.map((checkbox) => {
      const label = checkbox.closest("label");
      const bounds = label?.getBoundingClientRect();
      return { width: bounds?.width || 0, height: bounds?.height || 0 };
    }),
  );
  expect(checkboxTargets.every((target) => target.width >= 44 && target.height >= 44)).toBe(true);

  await expectAccessibilityFoundation(page, { repeatedHeader: true });
  await page.setViewportSize({ width: 320, height: 844 });
  const reflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(reflow.documentWidth).toBeLessThanOrEqual(reflow.viewportWidth);
});

for (const route of ["/emar", "/medication"]) {
  test(`Tenant admin ${route} is safely excluded`, async ({ page }) => {
    await signIn(page, profiles.tenantAdmin);
    await page.goto(route);
    await expect(page).toHaveURL(/\/access\/feature-not-enabled$/);
    await expect(
      page.getByRole("heading", { name: "Medication and eMAR are not available" }),
    ).toBeVisible();
    await expectAccessibilityFoundation(page);
  });
}

test("Carer Today", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No visits assigned today" })).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("visit detail", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto(`/visits/${VISIT_ID}`);
  await expect(page).toHaveURL(new RegExp(`/visits/${VISIT_ID}$`));
  await expect(page.getByRole("heading", { name: "Jordan Ellis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visit details" })).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});

test("Family home", async ({ page }) => {
  await signIn(page, profiles.family);
  await page.goto("/family");
  await expect(page).toHaveURL(/\/family$/);
  await expect(
    page.getByRole("heading", { name: "Stay up to date with their care" }),
  ).toBeVisible();
  await expect(page.getByText("You do not have access to anyone’s updates yet.")).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
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
  await expect(page.getByRole("heading", { name: "No concerns in this view" })).toBeVisible();
  await expectAccessibilityFoundation(page, { repeatedHeader: true });
});
