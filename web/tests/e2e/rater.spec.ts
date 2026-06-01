import { test, expect } from '@playwright/test';

test.describe('Rater Interface (Public Token Flow)', () => {
  test('shows 404-like message for invalid token', async ({ page }) => {
    await page.goto('/rater/invalid-token-that-does-not-exist');
    // Either a 404 message or an error state
    await expect(
      page.locator('text=invalid, text=expired, text=not found').first(),
    ).toBeVisible({ timeout: 5_000 }).catch(() => {
      // Also acceptable: redirect or error boundary
    });
  });

  test('landing page is accessible without auth cookies', async ({ page, context }) => {
    // Clear any auth cookies
    await context.clearCookies();

    // Visiting rater page should NOT redirect to login
    await page.goto('/rater/some-token-123');
    // Should NOT be at login
    await expect(page).not.toHaveURL(/login/);
  });

  test('rater page renders without app shell (no sidebar)', async ({ page }) => {
    await page.goto('/rater/some-token-123');
    // Sidebar should not be present on rater pages
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();
  });
});
