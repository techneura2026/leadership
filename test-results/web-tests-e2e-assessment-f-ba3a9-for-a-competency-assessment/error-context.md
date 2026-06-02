# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web\tests\e2e\assessment-flow.spec.ts >> Assessment Flow >> creates, assigns, takes and views results for a competency assessment
- Location: web\tests\e2e\assessment-flow.spec.ts:29:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * End-to-end test for the full assessment flow:
  5   |  *   1. Admin logs in
  6   |  *   2. Creates a Competency assessment with seeded competencies and assigns themselves
  7   |  *   3. Launches the assessment
  8   |  *   4. Navigates to My Assessments and opens the detail page
  9   |  *   5. Starts the assessment, rates every competency, submits
  10  |  *   6. Results page shows competency profile
  11  |  *
  12  |  * Prerequisites (run once before the test suite):
  13  |  *   npm run db:seed   — seeds admin@acme.com and competency framework
  14  |  */
  15  | 
  16  | const ADMIN_EMAIL = 'admin@acme.com';
  17  | const ADMIN_PASSWORD = 'Password123!';
  18  | const ASSESSMENT_TITLE = `E2E Competency ${Date.now()}`;
  19  | 
  20  | async function login(page: import('@playwright/test').Page) {
> 21  |   await page.goto('/login');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  22  |   await page.fill('input[name="email"]', ADMIN_EMAIL);
  23  |   await page.fill('input[name="password"]', ADMIN_PASSWORD);
  24  |   await page.click('button[type="submit"]');
  25  |   await expect(page).toHaveURL('/dashboard', { timeout: 10_000 });
  26  | }
  27  | 
  28  | test.describe('Assessment Flow', () => {
  29  |   test('creates, assigns, takes and views results for a competency assessment', async ({ page }) => {
  30  |     // ── Step 1: Login ────────────────────────────────────────────────────────
  31  |     await login(page);
  32  | 
  33  |     // ── Step 2: Open New Assessment wizard ───────────────────────────────────
  34  |     await page.click('text=New Assessment');
  35  |     await expect(page.locator('h1')).toContainText('New Assessment');
  36  | 
  37  |     // Select Competency type
  38  |     await page.click('text=Competency Assessment');
  39  |     await expect(page.locator('button.border-blue-600')).toBeVisible();
  40  |     await page.click('text=Next');
  41  | 
  42  |     // Fill in details
  43  |     await expect(page.locator('h2')).toContainText('Assessment Details');
  44  |     await page.fill('input[placeholder*="Mid-Year"]', ASSESSMENT_TITLE);
  45  |     const today = new Date();
  46  |     const end = new Date(today);
  47  |     end.setDate(end.getDate() + 30);
  48  |     const fmt = (d: Date) => d.toISOString().split('T')[0];
  49  |     await page.fill('input[type="date"]:first-of-type', fmt(today));
  50  |     await page.fill('input[type="date"]:last-of-type', fmt(end));
  51  |     await page.click('text=Next');
  52  | 
  53  |     // ── Step 3: Select at least one competency ───────────────────────────────
  54  |     await expect(page.locator('h2')).toContainText('Select Competencies');
  55  |     // Wait for competencies to load
  56  |     await expect(page.locator('label input[type="checkbox"]').first()).toBeVisible({ timeout: 10_000 });
  57  |     // Select first three competencies
  58  |     const checkboxes = page.locator('label input[type="checkbox"]');
  59  |     const count = await checkboxes.count();
  60  |     const toSelect = Math.min(3, count);
  61  |     for (let i = 0; i < toSelect; i++) {
  62  |       await checkboxes.nth(i).check();
  63  |     }
  64  |     await expect(page.locator('text=/\\d+ selected/')).toBeVisible();
  65  |     await page.click('text=Next');
  66  | 
  67  |     // ── Step 4: Add admin user as participant ────────────────────────────────
  68  |     await expect(page.locator('h2')).toContainText('Add Participants');
  69  |     await expect(page.locator('label input[type="checkbox"]').first()).toBeVisible({ timeout: 10_000 });
  70  |     // Search for admin and select
  71  |     await page.fill('input[placeholder*="Search"]', 'Acme');
  72  |     await page.waitForTimeout(300);
  73  |     const participantCheckboxes = page.locator('label input[type="checkbox"]');
  74  |     await participantCheckboxes.first().check();
  75  |     await page.click('text=Next');
  76  | 
  77  |     // ── Step 5: Review and launch ────────────────────────────────────────────
  78  |     await expect(page.locator('h2')).toContainText('Review');
  79  |     await expect(page.locator('text=' + ASSESSMENT_TITLE)).toBeVisible();
  80  |     await page.click('text=Launch Assessment');
  81  | 
  82  |     // Should redirect to the assessment detail page
  83  |     await expect(page).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/, { timeout: 10_000 });
  84  | 
  85  |     // ── Step 6: Navigate to My Assessments ───────────────────────────────────
  86  |     await page.goto('/my-assessments');
  87  |     await expect(page.locator('h1')).toContainText('My Assessments');
  88  | 
  89  |     // Find and click the card for the newly created assessment
  90  |     const card = page.locator(`text=${ASSESSMENT_TITLE}`).first();
  91  |     await expect(card).toBeVisible({ timeout: 10_000 });
  92  |     // Click the Start Assessment button in the same card
  93  |     await card.locator('..').locator('..').locator('button').click();
  94  | 
  95  |     // ── Step 7: Assessment detail page ──────────────────────────────────────
  96  |     await expect(page).toHaveURL(/\/my-assessments\/[0-9a-f-]{36}$/, { timeout: 5_000 });
  97  |     await expect(page.locator('h1')).toContainText(ASSESSMENT_TITLE);
  98  |     await expect(page.locator('text=What to expect')).toBeVisible();
  99  |     await page.click('text=Start Self-Assessment');
  100 | 
  101 |     // ── Step 8: Take the assessment ──────────────────────────────────────────
  102 |     await expect(page).toHaveURL(/\/take$/, { timeout: 5_000 });
  103 | 
  104 |     // Rate each competency as Proficient (value 3) — click through all
  105 |     let onReview = false;
  106 |     for (let i = 0; i < 20; i++) {
  107 |       // Check if we're on the review screen
  108 |       const reviewHeading = page.locator('text=Review & Submit');
  109 |       if (await reviewHeading.isVisible()) { onReview = true; break; }
  110 | 
  111 |       // Click "Proficient" (3rd button in the scale row)
  112 |       const proficientBtn = page.locator('button:has-text("Proficient")').first();
  113 |       if (await proficientBtn.isVisible()) {
  114 |         await proficientBtn.click();
  115 |         await page.waitForTimeout(200);
  116 |       }
  117 | 
  118 |       // Click "Save & Continue" or "Review & Submit"
  119 |       const continueBtn = page.locator('button:has-text("Save & Continue"), button:has-text("Review & Submit")').first();
  120 |       if (await continueBtn.isVisible() && !(await continueBtn.isDisabled())) {
  121 |         await continueBtn.click();
```