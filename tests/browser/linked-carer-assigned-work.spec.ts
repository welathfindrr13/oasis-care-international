import { expect, test } from 'playwright/test';

const VISIT_ID = '55555555-5555-4555-8555-555555555555';
const UNASSIGNED_VISIT_ID = '55555555-5555-4555-8555-666666666666';

test('a linked fake carer reaches and starts only their assigned work', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

  const csrfResponse = await page.request.get('/api/auth/csrf');
  const { csrfToken } = await csrfResponse.json();
  const authResponse = await page.request.post('/api/auth/callback/oasis-local', {
    form: {
      csrfToken,
      callbackUrl: 'http://localhost:3002/visits',
      email: 'carer@local.dev',
      name: 'Local Carer',
      role: 'carer',
      organizationId: '',
    },
  });
  expect(authResponse.ok()).toBe(true);

  await page.goto('/visits');

  await expect(page).toHaveURL('/visits');

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
