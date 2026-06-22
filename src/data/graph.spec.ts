import { describe, it, expect } from "vitest";
import { buildGraph } from "@/data/graph";
import type { Genre } from "@/data/genres";

const GENRES: Genre[] = [
  { id: "rock", name: "Rock", family: "rock", parents: [], related: ["pop"] },
  { id: "alt-rock", name: "Alternative Rock", family: "rock", parents: ["rock"] },
  { id: "pop", name: "Pop", family: "pop", parents: [] },
];

describe("buildGraph", () => {
  it("crea un nodo por cada género", () => {
    // Act
    const { nodes } = buildGraph(GENRES);
    // Assert
    expect(nodes).toHaveLength(3);
  });

  it("crea una arista parent cuando el padre existe", () => {
    // Act
    const { links } = buildGraph(GENRES);
    // Assert
    expect(links).toContainEqual({ source: "rock", target: "alt-rock", kind: "parent" });
  });

  it("crea una arista related cuando el relacionado existe", () => {
    // Act
    const { links } = buildGraph(GENRES);
    // Assert
    expect(links).toContainEqual({ source: "rock", target: "pop", kind: "related" });
  });

  it("ignora referencias a géneros que no están en la lista", () => {
    // Arrange
    const genres: Genre[] = [{ id: "x", name: "X", family: "rock", parents: ["fantasma"] }];
    // Act
    const { links } = buildGraph(genres);
    // Assert
    expect(links).toEqual([]);
  });

  it("asigna mayor tamaño (val) a un género con más hijos", () => {
    // Act
    const { nodes } = buildGraph(GENRES);
    const rock = nodes.find((n) => n.id === "rock");
    const altRock = nodes.find((n) => n.id === "alt-rock");
    // Assert
    expect(rock!.val).toBeGreaterThan(altRock!.val);
  });
});
