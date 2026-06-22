import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock del cliente HTTP: loadGenres() consume apiFetch sin tocar la red.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === "/genres") {
      return [
        { id: "rock", name: "Rock", family: "rock", parents: [], related: [] },
        { id: "alt-rock", name: "Alternative Rock", family: "rock", parents: ["rock"] },
      ];
    }
    if (path === "/families") {
      return [{ id: "rock", name: "Rock" }];
    }
    return [];
  }),
}));

import { apiFetch } from "@/lib/api";
import {
  loadGenres,
  getGenreById,
  getFamilyColor,
  getGenres,
  getFamilies,
} from "@/data/genres";

describe("genreStore", () => {
  beforeEach(async () => {
    await loadGenres();
  });

  describe("loadGenres", () => {
    it("carga los géneros mapeando parents/related con defaults", async () => {
      // Act
      const genres = getGenres();
      // Assert
      expect(genres).toHaveLength(2);
    });

    it("aplica array vacío a related cuando no viene en la respuesta", () => {
      // Act
      const genre = getGenreById("alt-rock");
      // Assert
      expect(genre?.related).toEqual([]);
    });

    it("carga las familias con su color CSS", () => {
      // Act
      const families = getFamilies();
      // Assert
      expect(families).toEqual([{ id: "rock", name: "Rock", color: "hsl(var(--family-rock))" }]);
    });

    it("propaga el error cuando falla la petición al backend", async () => {
      // Arrange
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error("network"));
      // Act + Assert
      await expect(loadGenres()).rejects.toThrow("network");
    });
  });

  describe("getGenreById", () => {
    it("devuelve el género cuando existe", () => {
      // Act
      const genre = getGenreById("rock");
      // Assert
      expect(genre?.name).toBe("Rock");
    });

    it("devuelve undefined cuando el id no existe", () => {
      // Act
      const genre = getGenreById("no-existe");
      // Assert
      expect(genre).toBeUndefined();
    });
  });

  describe("getFamilyColor", () => {
    it("devuelve el color de una familia cargada", () => {
      // Act
      const color = getFamilyColor("rock");
      // Assert
      expect(color).toBe("hsl(var(--family-rock))");
    });

    it("cae al color por defecto del mapa cuando la familia no está cargada", () => {
      // Act
      const color = getFamilyColor("metal");
      // Assert
      expect(color).toBe("hsl(var(--family-metal))");
    });
  });
});
