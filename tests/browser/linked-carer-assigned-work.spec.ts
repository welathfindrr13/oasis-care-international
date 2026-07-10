import { expect, test } from 'playwright/test';

const VISIT_ID = '55555555-5555-4555-8555-555555555555';
const UNASSIGNED_VISIT_ID = '55555555-5555-4555-8555-666666666666';

async function signIn(
  page: import('playwright/test').Page,
  profile: { email: string; name: string; role: string; callbackUrl?: string },
) {
  const csrfResponse = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();
  const authResponse = await page.request.post('/api/auth/callback/oasis-local', {
    form: {
      csrfToken,
      callbackUrl: profile.callbackUrl || 'http://localhost:3002/access',
      email: profile.email,
      name: profile.name,
      role: profile.role,
      organizationId: '',
    },
  });
  expect(authResponse.ok()).toBe(true);
}

async function refreshMountedNextAuthSession(page: import('playwright/test').Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'nextauth.message',
        newValue: JSON.stringify({
          event: 'session',
          data: { trigger: 'getSession' },
          timestamp: Math.floor(Date.now() / 1000),
        }),
      }),
    );
  });
}

test('a linked fake carer follows the database role despite an admin token claim', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  await signIn(page, {
    email: 'carer@local.dev',
    name: 'Local Carer',
    role: 'admin',
    callbackUrl: 'http://localhost:3002/visits',
  });

  await page.goto('/visits');

  await expect(page).toHaveURL('/visits');
  await expect(page.getByRole('link', { name: 'Management' })).toHaveCount(0);

  const assignedVisit = page.locator(`a[href="/schedule/${VISIT_ID}"]`);
  await expect(assignedVisit).toHaveCount(1);
  await expect(page.locator(`a[href="/schedule/${UNASSIGNED_VISIT_ID}"]`)).toHaveCount(0);
  await assignedVisit.click();

  await expect(page).toHaveURL(`/schedule/${VISIT_ID}`);
  await expect(page.getByRole('heading', { name: 'Care Visit' })).toBeVisible();
  await expect(page.getByText('Browser Carer', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirm assigned visit', { exact: true })).toBeVisible();

  const startVisit = page.getByRole('button', { name: 'Start visit' });
  await expect(startVisit).toBeEnabled();
  await startVisit.click();

  await expect(page.getByText('Visit started.', { exact: true })).toBeVisible();
  await expect(page.getByText('in progress', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Mark done' })).toBeEnabled();
});

test('account switching clears stale capabilities and follows each database membership', async ({ page }) => {
  let releaseOldSnapshot!: () => void;
  let markOldSnapshotStarted!: () => void;
  const oldSnapshotStarted = new Promise<void>((resolve) => {
    markOldSnapshotStarted = resolve;
  });
  const holdOldSnapshot = new Promise<void>((resolve) => {
    releaseOldSnapshot = resolve;
  });
  let holdNextSnapshot = true;
  await page.route('**/api/access-context', async (route) => {
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
    email: 'carer@local.dev',
    name: 'Local Carer',
    role: 'admin',
  });
  await page.goto('/visits');
  await oldSnapshotStarted;
  await expect(page.getByText('Assigned Fake Client', { exact: true })).toBeVisible();

  await signIn(page, {
    email: 'admin@local.dev',
    name: 'Local Admin',
    role: 'user',
  });
  await refreshMountedNextAuthSession(page);
  await expect(page).toHaveURL('/today');
  releaseOldSnapshot();
  await expect(page.getByRole('link', { name: 'Management' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Family Assurance' })).toHaveCount(0);

  await signIn(page, {
    email: 'family@local.dev',
    name: 'Local Family',
    role: 'user',
  });
  await refreshMountedNextAuthSession(page);
  await expect(page).toHaveURL('/family');
  await expect(page.getByRole('link', { name: 'Family Assurance', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Management' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Schedule' })).toHaveCount(0);
});

test('an administrator sees the real organization in the guided synthetic setup', async ({ page }) => {
  await signIn(page, {
    email: 'admin@local.dev',
    name: 'Local Admin',
    role: 'user',
    callbackUrl: 'http://localhost:3002/admin/setup',
  });

  await page.goto('/admin/setup');

  await expect(page).toHaveURL('/admin/setup');
  await expect(
    page.getByRole('heading', { name: 'Prepare your Oasis workspace' }),
  ).toBeVisible();
  await expect(
    page.getByText('Linked Carer Browser Proof', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('org-browser-linked-carer', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Billing is not part of this setup.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Add synthetic person →' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Schedule visit →' }),
  ).toBeVisible();
});
