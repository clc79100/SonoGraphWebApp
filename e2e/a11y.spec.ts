import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// TC-A11Y-001 a TC-A11Y-004 — Auditoría WCAG 2.1 con axe-core.
test.describe("Accesibilidad (axe-core WCAG 2.1 AA)", () => {
  test("TC-A11Y-001: homepage sin violaciones críticas", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[data-testid="login-button"]');

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toEqual(
      [],
    );
  });

  test("TC-A11Y-003: modal de registro sin violaciones", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.getByTestId("tab-register").click();
    await page.waitForSelector('[data-testid="register-email"]');

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.length).toBe(0);
  });

  test("TC-A11Y-004: homepage con sesión iniciada sin violaciones críticas", async ({
    page,
  }) => {
    // Registrar usuario para tener sesión activa
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.getByTestId("tab-register").click();
    const email = `a11y-${Date.now()}@sono.test`;
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill("password123");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("logout-button")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toEqual(
      [],
    );
  });
});
