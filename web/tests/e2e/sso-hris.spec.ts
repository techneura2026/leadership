import { test, expect, APIRequestContext } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3101/api/v1';

async function issueTicket(request: APIRequestContext): Promise<{ url: string; lastName: string }> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const reg = await request.post(`${API}/auth/register`, {
    data: {
      orgName: `SSO Org ${stamp}`, orgSlug: `sso-${stamp}`, firstName: 'Admin', lastName: 'User',
      email: `sso-admin-${stamp}@test.lk`, password: 'Test1234!',
    },
  });
  expect(reg.ok()).toBeTruthy();
  const adminToken = (await reg.json()).data.accessToken;

  const keyRes = await request.post(`${API}/integrations/api-clients`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: 'HRIS', scopes: ['employees:write', 'sso:issue'] },
  });
  const key = (await keyRes.json()).data.rawKey;

  const lastName = `Wijesinghe${stamp}`;
  const sync = await request.put(`${API}/integrations/hris/employees`, {
    headers: { 'X-Api-Key': key },
    data: { employees: [{ employeeRef: 'E-1', email: `e1-${stamp}@hris.lk`, firstName: 'Savindi', lastName, employmentStatus: 'active' }] },
  });
  expect(sync.ok()).toBeTruthy();

  const ticket = await request.post(`${API}/integrations/hris/sso-tickets`, {
    headers: { 'X-Api-Key': key },
    data: { employeeRef: 'E-1', redirectPath: '/my-assessments' },
  });
  expect(ticket.status()).toBe(201);
  return { url: (await ticket.json()).data.url, lastName };
}

test.describe('HRIS single sign-on hand-off', () => {
  test('a ticket link signs the employee in and lands on My Assessments; reusing it shows the expired message', async ({ page, request }) => {
    const { url, lastName } = await issueTicket(request);
    const path = new URL(url).pathname + new URL(url).search;

    await page.goto(path);
    await expect(page).toHaveURL(/\/my-assessments$/, { timeout: 20_000 });
    await expect(page.getByText(lastName).first()).toBeVisible();

    await page.context().clearCookies();
    await page.goto(path);
    await expect(page.getByText('This sign-in link has expired or was already used.')).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
