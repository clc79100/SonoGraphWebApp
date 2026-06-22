import { Page, expect } from "@playwright/test";

// Email único por test para evitar 409 (conflicto) entre corridas.
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}@sono.test`;
}

export const PASSWORD = "password123";

// Registra un usuario nuevo desde la UI y deja la sesión iniciada.
export async function registerNewUser(page: Page, email: string): Promise<void> {
  await page.getByTestId("login-button").click();
  await page.getByTestId("tab-register").click();
  await page.getByTestId("register-email").fill(email);
  await page.getByTestId("register-password").fill(PASSWORD);
  await page.getByTestId("register-submit").click();
  // La sesión iniciada se refleja en el header (botón con el email → logout).
  await expect(page.getByTestId("logout-button")).toContainText(email);
}
