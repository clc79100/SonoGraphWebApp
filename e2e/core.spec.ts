import { test, expect } from "@playwright/test";
import { registerNewUser, uniqueEmail } from "./helpers";

// TC-E2E-003 — Flujo core del negocio: buscar artista → ver detalle → marcar favorito.
// Usa el buscador (no el canvas del grafo). La búsqueda pega a la fuente real (MusicBrainz).
test("TC-E2E-003: flujo core — buscar artista, ver detalle y marcar favorito", async ({
  page,
}) => {
  // Arrange: sesión iniciada (los favoritos requieren auth).
  await page.goto("/");
  await registerNewUser(page, uniqueEmail());

  // Cambiar a modo Artista y buscar.
  await page.getByTestId("mode-artist").click();
  await page.getByTestId("search-input").fill("Radiohead");

  // Resultados de la API externa (puede tardar por rate-limit de MusicBrainz).
  const firstResult = page.getByTestId("artist-result").first();
  await expect(firstResult).toBeVisible({ timeout: 40_000 });
  await page.screenshot({ path: "screenshots/05-resultados-busqueda.png" });

  // Seleccionar el primer artista → se abre el detalle.
  await firstResult.click();
  const favButton = page.getByTestId("artist-fav-button");
  await expect(favButton).toBeVisible({ timeout: 40_000 });
  await page.screenshot({ path: "screenshots/06-detalle-artista.png" });

  // Marcar favorito → la acción cambia a "Quitar de favoritos".
  await favButton.click();
  await expect(favButton).toHaveAttribute("aria-label", "Quitar de favoritos");
  await page.screenshot({ path: "screenshots/07-favorito-marcado.png" });
});
