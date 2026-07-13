import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "playwright/test";

const VISIT_ID = "77777777-7777-4777-8777-777777777777";

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

async function expectAccessibilityFoundation(
  page: Page,
  {
    expectMain = true,
    axeBaseline = [],
  }: { expectMain?: boolean; axeBaseline?: Array<{ id: string; targets: string[] }> } = {},
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (expectMain) {
    await expect(page.locator("main")).toBeVisible();
  }
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

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await page.keyboard.press("Tab");
  const keyboardFocus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return null;
    }
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const accessibleName =
      element.getAttribute("aria-label")?.trim() ||
      element.textContent?.trim() ||
      element.getAttribute("name")?.trim() ||
      element.getAttribute("title")?.trim() ||
      "";
    return {
      visible:
        bounds.width > 0 &&
        bounds.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none",
      focusVisible: element.matches(":focus-visible"),
      accessibleName,
      withinViewport:
        bounds.right > 0 &&
        bounds.left < window.innerWidth &&
        bounds.bottom > 0 &&
        bounds.top < window.innerHeight,
    };
  });
  expect(keyboardFocus).not.toBeNull();
  expect(keyboardFocus?.visible).toBe(true);
  expect(keyboardFocus?.focusVisible).toBe(true);
  expect(keyboardFocus?.withinViewport).toBe(true);
  expect(keyboardFocus?.accessibleName).not.toBe("");

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
  expect(normalizedViolations).toEqual(axeBaseline);
}

test("Login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Workspace")).toBeVisible();
  await expectAccessibilityFoundation(page, {
    expectMain: false,
    axeBaseline: [
      {
        id: "color-contrast",
        targets: [
          ".gap-2.items-center.flex:nth-child(1) > span",
          ".gap-2.items-center.flex:nth-child(2) > span",
          ".mt-8",
          ".py-6 > p",
          ".uppercase",
        ],
      },
    ],
  });
});

test("Tenant admin Today", async ({ page }) => {
  await signIn(page, profiles.tenantAdmin);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await expect(page.getByText("No visits scheduled today")).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("Carer Today", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No visits assigned today" })).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("visit detail", async ({ page }) => {
  await signIn(page, profiles.carer);
  await page.goto(`/visits/${VISIT_ID}`);
  await expect(page).toHaveURL(new RegExp(`/visits/${VISIT_ID}$`));
  await expect(page.getByRole("heading", { name: "Jordan Ellis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Visit details" })).toBeVisible();
  await expectAccessibilityFoundation(page);
});

test("Family home", async ({ page }) => {
  await signIn(page, profiles.family);
  await page.goto("/family");
  await expect(page).toHaveURL(/\/family$/);
  await expect(
    page.getByRole("heading", { name: "Stay up to date with their care" }),
  ).toBeVisible();
  await expect(page.getByText("You do not have access to anyone’s updates yet.")).toBeVisible();
  await expectAccessibilityFoundation(page);
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
  await expectAccessibilityFoundation(page);
});
