import { test, expect } from "@playwright/test";
import { registerNewUser, uniqueEmail, PASSWORD } from "./helpers";

// TC-E2E-001 y TC-E2E-002 — Registro y Login/Logout.
test.describe("Autenticación", () => {
  test("TC-E2E-001: registro de usuario nuevo (con validación de formulario)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("login-button").click();
    await page.getByTestId("tab-register").click();

    // Validación del formulario: contraseña demasiado corta → error visible.
    await page.getByTestId("register-email").fill(uniqueEmail());
    await page.getByTestId("register-password").fill("123");
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await page.screenshot({ path: "screenshots/01-registro-validacion.png" });

    // Registro válido → sesión iniciada.
    const email = uniqueEmail();
    await page.getByTestId("register-email").fill(email);
    await page.getByTestId("register-password").fill(PASSWORD);
    await page.getByTestId("register-submit").click();
    await expect(page.getByTestId("logout-button")).toContainText(email);
    await page.screenshot({ path: "screenshots/02-registro-exitoso.png" });
  });

  test("TC-E2E-002: login/logout con credenciales válidas e inválidas", async ({ page }) => {
    // Arrange: crear un usuario y cerrar sesión.
    const email = uniqueEmail();
    await page.goto("/");
    await registerNewUser(page, email);
    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("login-button")).toBeVisible();

    // Credenciales inválidas → error visible.
    await page.getByTestId("login-button").click();
    await page.getByTestId("tab-login").click();
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill("contrasena-incorrecta");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await page.screenshot({ path: "screenshots/03-login-invalido.png" });

    // Credenciales válidas → sesión iniciada.
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("logout-button")).toContainText(email);
    await page.screenshot({ path: "screenshots/04-login-exitoso.png" });
  });
});
