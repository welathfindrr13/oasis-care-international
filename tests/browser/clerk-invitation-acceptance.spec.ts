import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from 'playwright/test';

const INVITATION_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_KEY = 'oasis.synthetic-clerk-session';

async function mockActivation(page: Page, outcome: 'active' | 'forbidden') {
  let activated = false;
  await page.route('**/api/access-context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        organizationId: null,
        effectiveRole: activated ? 'carer' : null,
        membershipState: activated ? 'ACTIVE' : 'MISSING',
        surface: 'NONE',
        linkedIdentityState: activated ? 'REQUIRED' : 'NOT_REQUIRED',
        onboardingState: activated ? 'SETUP_REQUIRED' : 'NOT_STARTED',
        resolution: 'DENIED',
        capabilities: [],
      }),
    });
  });
  await page.route('**/api/graphql', async (route) => {
    const payload = route.request().postDataJSON() as {
      variables?: { input?: { invitationId?: string } };
    };
    expect(payload.variables?.input?.invitationId).toBe(INVITATION_ID);
    if (outcome === 'active') activated = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        outcome === 'active'
          ? {
              data: {
                activateViewerOrganizationInvitation: {
                  status: 'ACTIVE',
                  externalOrganizationId: 'org_synthetic_clerk',
                  nextPath: '/access/setup',
                },
              },
            }
          : {
              errors: [
                {
                  message: 'Invitation activation is unavailable',
                  extensions: { code: 'FORBIDDEN' },
                },
              ],
            },
      ),
    });
  });
}

async function expectAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).include('main').analyze();
  expect(result.violations).toEqual([]);
}

async function waitForClerkStub(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as any).__OASIS_SYNTHETIC_CLERK_READY__ === true,
      ),
    )
    .toBe(true);
}

test('an unaffiliated Clerk user reaches governed company access without creating an organization', async ({
  page,
}) => {
  await page.goto('/login?browser_clerk_scenario=unaffiliated');
  await page
    .getByRole('button', { name: 'Continue with unaffiliated account' })
    .click();

  await expect(page).toHaveURL('/session-tasks/choose-organization');
  await page.goto('/login/tasks');
  await expect(page).toHaveURL('/session-tasks/choose-organization');
  await expect(
    page.getByRole('heading', { name: 'Company access is not ready' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Request company access' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Use a different account' }),
  ).toBeVisible();
  await expect(
    page.getByText('No care information has been loaded.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /create organization/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /create organization/i }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem('oasis.synthetic-clerk-organization'),
      ),
    )
    .toBeNull();
  await expectAccessible(page);

  await page.getByRole('link', { name: 'Request company access' }).click();
  await expect(page).toHaveURL('/request-access');
  await expect(
    page.getByRole('heading', {
      name: 'Request a review for your care company',
    }),
  ).toBeVisible();
});

test('the governed company-access task remains usable without horizontal overflow', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 320, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/session-tasks/choose-organization');
    await expect(
      page.getByRole('heading', { name: 'Company access is not ready' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Request company access' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await expectAccessible(page);
  }
});

test('an approved user can activate an existing company before Oasis rechecks internal authority', async ({
  page,
}) => {
  await page.route('**/api/access-context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        organizationId: 'organization_synthetic_approved',
        effectiveRole: 'admin',
        membershipState: 'ACTIVE',
        surface: 'ADMIN',
        linkedIdentityState: 'NOT_REQUIRED',
        onboardingState: 'READY',
        resolution: 'READY',
        capabilities: ['TENANT_ADMIN'],
        medicationEmarEnabled: false,
      }),
    });
  });
  await page.goto('/login?browser_clerk_scenario=existing-organization');
  await page
    .getByRole('button', { name: 'Continue with approved company account' })
    .click();

  await expect(page).toHaveURL('/session-tasks/choose-organization');
  await page
    .getByRole('button', { name: 'Continue to Synthetic Approved Care' })
    .click();
  await expect(page).toHaveURL('/today');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem('oasis.synthetic-clerk-organization'),
      ),
    )
    .toBe('org_synthetic_approved');
});

test('an approved company remains selectable after loading another Clerk membership page', async ({
  page,
}) => {
  await page.route('**/api/access-context', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        organizationId: 'organization_synthetic_approved',
        effectiveRole: 'admin',
        membershipState: 'ACTIVE',
        surface: 'ADMIN',
        linkedIdentityState: 'NOT_REQUIRED',
        onboardingState: 'READY',
        resolution: 'READY',
        capabilities: ['TENANT_ADMIN'],
        medicationEmarEnabled: false,
      }),
    });
  });
  await page.goto(
    '/login?browser_clerk_scenario=paginated-existing-organization',
  );
  await page
    .getByRole('button', { name: 'Continue with paginated company account' })
    .click();

  await expect(page).toHaveURL('/session-tasks/choose-organization');
  await expect(
    page.getByRole('button', { name: 'Continue to Synthetic Approved Care' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Load more companies' }).click();
  await page
    .getByRole('button', { name: 'Continue to Synthetic Approved Care' })
    .click();

  await expect(page).toHaveURL('/today');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem('oasis.synthetic-clerk-organization'),
      ),
    )
    .toBe('org_synthetic_approved');
});

test('a newly invited Carer creates an account and activates into setup-required access', async ({
  page,
}) => {
  await mockActivation(page, 'active');
  await page.goto(
    `/accept-invitation?__clerk_ticket=ticket_new&__clerk_status=sign_up&oasis_invitation_id=${INVITATION_ID}&browser_clerk_scenario=new`,
  );
  await expect(
    page.getByRole('heading', { name: 'Accept your Oasis invitation' }),
  ).toBeVisible();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Create invited account' }).click();
  await expect(page).toHaveURL(
    `/activate-invitation?oasis_invitation_id=${INVITATION_ID}`,
  );
  await waitForClerkStub(page);
  await page.getByRole('button', { name: 'Activate secure workspace' }).click();
  await expect(page).toHaveURL('/access/setup');
  await expect(
    page.getByRole('heading', { name: 'Setup required' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem('oasis.synthetic-clerk-organization'),
      ),
    )
    .toBe('org_synthetic_clerk');
});

test('an existing signed-in Clerk user activates the accepted invitation', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ signedIn: true, userId: 'user_synthetic_existing' }),
      ),
    { key: SESSION_KEY },
  );
  await mockActivation(page, 'active');
  await page.goto(
    `/accept-invitation?__clerk_ticket=ticket_existing&__clerk_status=complete&oasis_invitation_id=${INVITATION_ID}`,
  );
  await expect(page).toHaveURL(
    `/activate-invitation?oasis_invitation_id=${INVITATION_ID}`,
  );
  await page.getByRole('button', { name: 'Activate secure workspace' }).click();
  await expect(page).toHaveURL('/access/setup');
});

test('the wrong Clerk account receives only the sanitized activation denial', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({ signedIn: true, userId: 'user_synthetic_wrong' }),
      ),
    { key: SESSION_KEY },
  );
  await mockActivation(page, 'forbidden');
  await page.goto(`/activate-invitation?oasis_invitation_id=${INVITATION_ID}`);
  await page.getByRole('button', { name: 'Activate secure workspace' }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    'We could not safely activate this invitation. Use the invited account or try again shortly.',
  );
  await expect(page).toHaveURL(
    `/activate-invitation?oasis_invitation_id=${INVITATION_ID}`,
  );
  await expect(
    page.getByText('Invitation activation is unavailable'),
  ).toHaveCount(0);
  await expectAccessible(page);
});
