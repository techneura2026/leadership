import { test, expect, Page } from '@playwright/test';

const PASSWORD = 'Test1234!';

async function registerAdmin(page: Page) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await page.goto('/register');
  await page.fill('input[name="orgName"]', `Integrations Org ${stamp}`);
  await page.waitForTimeout(200);
  await page.fill('input[name="orgSlug"]', `integrations-${stamp}`);
  await page.fill('input[name="firstName"]', 'Ishara');
  await page.fill('input[name="lastName"]', 'Perera');
  await page.fill('input[name="email"]', `integrations-${stamp}@test.lk`);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
}

test.describe('Settings → Integrations', () => {
  test('admin creates an API key, sees it once, and can revoke it', async ({ page }) => {
    await registerAdmin(page);
    await page.goto('/settings/integrations');
    await expect(page.getByRole('heading', { name: 'API keys' })).toBeVisible();

    await page.getByRole('button', { name: 'Create API key' }).click();
    await page.getByLabel('Key name').fill('Main HRIS');
    await page.getByLabel('results:read').check();
    await page.getByRole('button', { name: 'Create key' }).click();

    const rawKey = page.getByTestId('new-api-key');
    await expect(rawKey).toHaveText(/^lpk_[A-Za-z0-9]{8}_/);
    await expect(page.getByText('This key will not be shown again.')).toBeVisible();
    const keyText = (await rawKey.textContent()) ?? '';
    const prefix = keyText.split('_')[1];

    await page.reload();
    await expect(page.getByText(keyText)).toHaveCount(0);
    const row = page.getByRole('row', { name: /Main HRIS/ });
    await expect(row).toContainText(prefix);

    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Revoke' }).click();
    await expect(row).toContainText('Revoked');
  });

  test('the audit log shows integration changes and can be filtered', async ({ page }) => {
    await registerAdmin(page);
    await page.goto('/settings/integrations');
    await page.getByRole('button', { name: 'Create API key' }).click();
    await page.getByLabel('Key name').fill('Audited HRIS');
    await page.getByLabel('results:read').check();
    await page.getByRole('button', { name: 'Create key' }).click();
    await expect(page.getByTestId('new-api-key')).toBeVisible();

    await page.goto('/settings/audit-log');
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
    const row = page.getByRole('row', { name: /integration\.api_client\.created/ });
    await expect(row).toBeVisible();
    await page.getByLabel('Action').fill('nothing.matches');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('No audit entries match.')).toBeVisible();
  });

  test('admin adds a webhook endpoint, sees its secret once, and a test ping is logged', async ({ page }) => {
    await registerAdmin(page);
    await page.goto('/settings/integrations');
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible();

    await page.getByRole('button', { name: 'Add endpoint' }).click();
    await page.getByLabel('Endpoint URL').fill('http://localhost:4599/leaderprism-hook');
    await page.getByLabel('assessment.closed').check();
    await page.getByRole('button', { name: 'Save endpoint' }).click();

    await expect(page.getByTestId('new-webhook-secret')).toHaveText(/^whsec_/);
    const endpointRow = page.getByRole('row', { name: /localhost:4599/ });
    await expect(endpointRow).toContainText('assessment.closed');

    await endpointRow.getByRole('button', { name: 'Send test' }).click();
    await expect(page.getByTestId('deliveries').getByRole('row', { name: /ping/ })).toBeVisible();
  });
});
