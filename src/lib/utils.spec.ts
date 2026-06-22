import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina varias clases en una cadena", () => {
    // Act
    const result = cn("px-2", "font-bold");
    // Assert
    expect(result).toBe("px-2 font-bold");
  });

  it("resuelve conflictos de Tailwind quedándose con la última", () => {
    // Act
    const result = cn("p-2", "p-4");
    // Assert
    expect(result).toBe("p-4");
  });

  it("ignora valores falsy (condicionales)", () => {
    // Arrange
    const isActive = false;
    // Act
    const result = cn("base", isActive && "active");
    // Assert
    expect(result).toBe("base");
  });
});
