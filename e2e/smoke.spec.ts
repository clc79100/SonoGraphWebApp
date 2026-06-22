import { test, expect } from "@playwright/test";

// TC-COMPAT-001 a TC-COMPAT-007 — Smoke test multi-browser/viewport.
test.describe("Compatibilidad multi-navegador y viewport", () => {
  test("TC-COMPAT-001: carga de homepage con elementos clave", async ({ page }) => {
    await page.goto("/");

    // La app carga sin errores
    await expect(page.locator("h1")).toContainText("SONOGRAPH");

    // El botón de login es visible
    await expect(page.getByTestId("login-button")).toBeVisible();

    // El panel de familias se renderiza
    await expect(page.getByText("Familias")).toBeVisible();

    // No hay errores de consola
    const logs: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") logs.push(msg.text());
    });
    await page.waitForTimeout(1000);
    expect(logs.length).toBe(0);
  });

  test("TC-COMPAT-002: modal de login se abre correctamente", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("login-button").click();

    // El modal es visible con tabs
    await expect(page.getByTestId("tab-login")).toBeVisible();
    await expect(page.getByTestId("tab-register")).toBeVisible();

    // Los campos del login están presentes
    await expect(page.getByTestId("login-email")).toBeVisible();
    await expect(page.getByTestId("login-password")).toBeVisible();
  });

  test("TC-COMPAT-003: alternancia entre modo género y artista", async ({ page }) => {
    await page.goto("/");

    // Click en modo Artista
    await page.getByTestId("mode-artist").click();
    await expect(page.getByTestId("search-input")).toBeVisible();

    // Volver a modo Género
    await page.getByTestId("mode-genre").click();
    await expect(page.getByTestId("search-input")).toBeVisible();
  });
});
