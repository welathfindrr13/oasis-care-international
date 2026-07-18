function exactPrimaryAction(page) {
  return page.getByRole('button', { name: /^(next|continue|sign in|log in|login)$/i }).first();
}

async function waitForPostLogin(page, baseUrl) {
  await page.waitForURL((url) => url.toString().startsWith(baseUrl) && !url.toString().includes('/login'), {
    timeout: 90000,
  });
  await page.waitForLoadState('networkidle', { timeout: 40000 }).catch(() => {});
}

export async function loginLiveProbeAccount(page, { baseUrl, account, localRole = 'admin' }) {
  await page.goto(`${baseUrl}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });

  const localWorkspace = page.locator('select').first();
  if (await localWorkspace.isVisible().catch(() => false)) {
    await localWorkspace.selectOption(localRole);
    await exactPrimaryAction(page).click({ timeout: 15000 });
    await waitForPostLogin(page, baseUrl);
    return;
  }

  const identifier = page.locator('input[name="identifier"], input[name="username"], input#identifier-field, input[type="email"]').first();
  await identifier.waitFor({ state: 'visible', timeout: 30000 });
  await identifier.fill(account.email);

  const password = page.locator('input[name="password"], input[type="password"]').first();
  if (!(await password.isVisible().catch(() => false))) {
    await exactPrimaryAction(page).click({ timeout: 15000 });
  }

  if (!(await password.isVisible().catch(() => false))) {
    const usePassword = page
      .locator('button, a')
      .filter({ hasText: /^use password$/i })
      .first();
    if (await usePassword.isVisible().catch(() => false)) {
      await usePassword.click({ timeout: 15000 });
    }
  }

  await password.waitFor({ state: 'visible', timeout: 30000 });
  await password.fill(account.password);
  await exactPrimaryAction(page).click({ timeout: 15000 });
  await waitForPostLogin(page, baseUrl);
}
