import { test, expect } from '@playwright/test';

const TEST_ORG_SLUG = `e2e-test-${Date.now()}`;
const TEST_EMAIL = `e2e-${Date.now()}@leaderprism-test.com`;
const TEST_PASSWORD = 'Test1234!';

test.describe('Authentication Flow', () => {
  test('registers a new organisation and lands on dashboard', async ({ page }) => {
    await page.goto('/register');

    await page.fill('input[name="orgName"]', 'E2E Test Organisation');
    await page.waitForTimeout(300); // let slug auto-populate

    await page.fill('input[name="orgSlug"]', TEST_ORG_SLUG);
    await page.fill('input[name="firstName"]', 'E2E');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('logs in with existing credentials', async ({ page }) => {
    // First register
    await page.goto('/register');
    const slug = `login-test-${Date.now()}`;
    const email = `login-${Date.now()}@test.com`;
    await page.fill('input[name="orgName"]', 'Login Test Org');
    await page.waitForTimeout(200);
    await page.fill('input[name="orgSlug"]', slug);
    await page.fill('input[name="firstName"]', 'Login');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });

    // Logout
    await page.click('text=Sign out');
    await expect(page).toHaveURL('/login', { timeout: 5_000 });

    // Login again
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'notfound@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('p.text-red-600, p[class*="red"]')).toBeVisible({ timeout: 5_000 });
  });

  test('redirects to login when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });

  test('redirects away from login when already authenticated', async ({ page }) => {
    // Register to get a session
    await page.goto('/register');
    const slug = `redir-test-${Date.now()}`;
    await page.fill('input[name="orgName"]', 'Redirect Test');
    await page.waitForTimeout(200);
    await page.fill('input[name="orgSlug"]', slug);
    await page.fill('input[name="firstName"]', 'Redir');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', `redir-${Date.now()}@test.com`);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });

    // Try visiting login page
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard', { timeout: 5_000 });
  });
});
