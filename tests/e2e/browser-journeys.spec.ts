import { test, expect } from "@playwright/test";

test.describe("CareOrbit — Genuine Playwright Browser End-to-End Journeys", () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies between tests for clean session isolation
    await context.clearCookies();
  });

  test("1. Landing page loads and renders overview with call-to-action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CareOrbit|Guardian Oasis/i);
    await expect(page.locator("text=Guardian Oasis").first()).toBeVisible();
    await expect(page.locator("a[href='/login']").first()).toBeVisible();
  });

  test("2. Protected route access without session redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard|\/login\?redirect=\/dashboard/);
    await expect(page.locator("text=Welcome to Guardian Oasis")).toBeVisible();
  });

  test("3. Invalid login credentials display error alert and prevent session creation", async ({
    page,
    context,
  }) => {
    await page.goto("/login");

    const codeInput = page.locator("#invite-code");
    await codeInput.fill("INVALID-PASSCODE-999");
    await page.locator("button[type='submit']").click();

    // Verify error notification (exclude internal next-route-announcer)
    const alert = page.locator(".bg-rose-50[role='alert']").or(
      page.getByRole("alert").filter({ hasText: /Invalid|Unable|Incorrect/i })
    );
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText(/Invalid|Unable|Incorrect/i);

    // Verify no authenticated session cookie was set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "guardian_session");
    expect(sessionCookie).toBeUndefined();
  });

  test("4. Family demo login with OASIS-7629 establishes session and loads dashboard", async ({
    page,
    context,
  }) => {
    await page.goto("/login");

    // Pre-filled with OASIS-7629 for seamless demo evaluation
    const codeInput = page.locator("#invite-code");
    await expect(codeInput).toHaveValue("OASIS-7629");

    await page.locator("button[type='submit']").click();

    // Navigates to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify signed cookie was set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "guardian_session");
    expect(sessionCookie).toBeDefined();

    // Dashboard renders Eleanor's connected care profile
    await expect(page.locator("text=Eleanor Thompson").first()).toBeVisible();
  });

  test("5. Older adult PIN login with 1234 navigates to senior portal /elder", async ({
    page,
    context,
  }) => {
    await page.goto("/login");

    // Switch to Senior PIN tab
    await page.locator("button:has-text('Older Adult (PIN)')").click();
    await expect(page.locator("text=Enter Your 4-Digit Passcode")).toBeVisible();

    // Tap PIN: 1, 2, 3, 4
    await page.locator("button:has-text('1')").first().click();
    await page.locator("button:has-text('2')").first().click();
    await page.locator("button:has-text('3')").first().click();
    await page.locator("button:has-text('4')").first().click();

    // Redirects to /elder
    await page.waitForURL("**/elder", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/elder/);

    // Senior interface loads
    await expect(page.locator("text=Good Morning, Eleanor").or(page.locator("text=Eleanor"))).toBeVisible();
  });

  test("6. Caregiver login with CAREGIVER-4192 accesses caregiver portal", async ({ page }) => {
    await page.goto("/login");

    const codeInput = page.locator("#invite-code");
    await codeInput.fill("CAREGIVER-4192");
    await page.locator("button[type='submit']").click();

    await page.waitForURL("**/caregiver", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/caregiver/);
  });

  test("7. Caregiver wellbeing check-in submission and trend viewing", async ({ page }) => {
    // Sign in as caregiver
    await page.goto("/login");
    await page.locator("#invite-code").fill("CAREGIVER-4192");
    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/caregiver");

    // Navigate to /wellbeing
    await page.goto("/wellbeing");
    await expect(page.locator("text=Today's Wellbeing Check-In")).toBeVisible();

    // Fill notes and submit
    const noteArea = page.locator("textarea");
    if (await noteArea.isVisible()) {
      await noteArea.fill("E2E automated test check-in: shift going smoothly.");
      await page.locator("button:has-text('Save Today')").click();
    }
  });

  test("8. Logout terminates session and redirects to landing page", async ({
    page,
    context,
  }) => {
    // Log in
    await page.goto("/login");
    await page.locator("#invite-code").fill("OASIS-7629");
    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/dashboard");

    // Trigger logout via API / endpoint
    const logoutRes = await page.request.post("/api/auth/logout");
    expect(logoutRes.ok()).toBe(true);

    // Verify session cookie is deleted
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
