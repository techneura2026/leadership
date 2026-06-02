import { test, expect } from '@playwright/test';

/**
 * End-to-end test for the full assessment flow:
 *   1. Admin logs in
 *   2. Creates a Competency assessment with seeded competencies and assigns themselves
 *   3. Launches the assessment
 *   4. Navigates to My Assessments and opens the detail page
 *   5. Starts the assessment, rates every competency, submits
 *   6. Results page shows competency profile
 *
 * Prerequisites (run once before the test suite):
 *   npm run db:seed   — seeds admin@acme.com and competency framework
 */

const ADMIN_EMAIL = 'admin@acme.com';
const ADMIN_PASSWORD = 'Password123!';
const ASSESSMENT_TITLE = `E2E Competency ${Date.now()}`;

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });
}

test.describe('Assessment Flow', () => {
  test('creates, assigns, takes and views results for a competency assessment', async ({ page }) => {
    // ── Step 1: Login ────────────────────────────────────────────────────────
    await login(page);

    // ── Step 2: Open New Assessment wizard ───────────────────────────────────
    await page.click('text=New Assessment');
    await expect(page.locator('h1')).toContainText('New Assessment');

    // Select Competency type
    await page.click('text=Competency Assessment');
    await expect(page.locator('button.border-blue-600')).toBeVisible();
    await page.click('text=Next');

    // Fill in details
    await expect(page.locator('h2')).toContainText('Assessment Details');
    await page.fill('input[placeholder*="Mid-Year"]', ASSESSMENT_TITLE);
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    await page.fill('input[type="date"]:first-of-type', fmt(today));
    await page.fill('input[type="date"]:last-of-type', fmt(end));
    await page.click('text=Next');

    // ── Step 3: Select at least one competency ───────────────────────────────
    await expect(page.locator('h2')).toContainText('Select Competencies');
    // Wait for competencies to load
    await expect(page.locator('label input[type="checkbox"]').first()).toBeVisible({ timeout: 10_000 });
    // Select first three competencies
    const checkboxes = page.locator('label input[type="checkbox"]');
    const count = await checkboxes.count();
    const toSelect = Math.min(3, count);
    for (let i = 0; i < toSelect; i++) {
      await checkboxes.nth(i).check();
    }
    await expect(page.locator('text=/\\d+ selected/')).toBeVisible();
    await page.click('text=Next');

    // ── Step 4: Add admin user as participant ────────────────────────────────
    await expect(page.locator('h2')).toContainText('Add Participants');
    await expect(page.locator('label input[type="checkbox"]').first()).toBeVisible({ timeout: 10_000 });
    // Search for admin and select
    await page.fill('input[placeholder*="Search"]', 'Acme');
    await page.waitForTimeout(300);
    const participantCheckboxes = page.locator('label input[type="checkbox"]');
    await participantCheckboxes.first().check();
    await page.click('text=Next');

    // ── Step 5: Review and launch ────────────────────────────────────────────
    await expect(page.locator('h2')).toContainText('Review');
    await expect(page.locator('text=' + ASSESSMENT_TITLE)).toBeVisible();
    await page.click('text=Launch Assessment');

    // Should redirect to the assessment detail page
    await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/, { timeout: 10_000 });

    // ── Step 6: Navigate to My Assessments ───────────────────────────────────
    await page.goto('/my-assessments');
    await expect(page.locator('h1')).toContainText('My Assessments');

    // Find and click the card for the newly created assessment
    const card = page.locator(`text=${ASSESSMENT_TITLE}`).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    // Click the Start Assessment button in the same card
    await card.locator('..').locator('..').locator('button').click();

    // ── Step 7: Assessment detail page ──────────────────────────────────────
    await expect(page).toHaveURL(/\/my-assessments\/[0-9a-f-]{36}$/, { timeout: 5_000 });
    await expect(page.locator('h1')).toContainText(ASSESSMENT_TITLE);
    await expect(page.locator('text=What to expect')).toBeVisible();
    await page.click('text=Start Self-Assessment');

    // ── Step 8: Take the assessment ──────────────────────────────────────────
    await expect(page).toHaveURL(/\/take$/, { timeout: 5_000 });

    // Rate each competency as Proficient (value 3) — click through all
    let onReview = false;
    for (let i = 0; i < 20; i++) {
      // Check if we're on the review screen
      const reviewHeading = page.locator('text=Review & Submit');
      if (await reviewHeading.isVisible()) { onReview = true; break; }

      // Click "Proficient" (3rd button in the scale row)
      const proficientBtn = page.locator('button:has-text("Proficient")').first();
      if (await proficientBtn.isVisible()) {
        await proficientBtn.click();
        await page.waitForTimeout(200);
      }

      // Click "Save & Continue" or "Review & Submit"
      const continueBtn = page.locator('button:has-text("Save & Continue"), button:has-text("Review & Submit")').first();
      if (await continueBtn.isVisible() && !(await continueBtn.isDisabled())) {
        await continueBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Submit from review screen
    if (!onReview) {
      await expect(page.locator('text=Review & Submit')).toBeVisible({ timeout: 5_000 });
    }
    await page.click('text=Submit Assessment');

    // ── Step 9: Results page ─────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/results$/, { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText(ASSESSMENT_TITLE);
    await expect(page.locator('text=Your Results')).toBeVisible();

    // Competency profile should show domain cards with proficiency badges
    await expect(page.locator('text=Proficient').first()).toBeVisible({ timeout: 5_000 });
  });
});
