// Construcción pura del grafo de géneros (nodos + aristas) a partir de la lista
// de géneros. Extraído de GenreGraph.tsx para poder testearlo sin react-force-graph.
import { getFamilyColor, type Genre, type FamilyId } from "@/data/genres";

export interface GraphNode {
  id: string;
  name: string;
  family: FamilyId;
  val: number; // tamaño del nodo
  color: string;
  genre: Genre;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: "parent" | "related";
}

export function buildGraph(genres: Genre[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = genres.map((g) => {
    const childCount = genres.filter((x) => x.parents?.includes(g.id)).length;
    return {
      id: g.id,
      name: g.name,
      family: g.family,
      val: 2 + Math.sqrt(childCount + 1) * 2,
      color: getFamilyColor(g.family),
      genre: g,
    };
  });

  const links: GraphLink[] = [];
  for (const g of genres) {
    for (const p of g.parents || []) {
      if (genres.some((x) => x.id === p)) links.push({ source: p, target: g.id, kind: "parent" });
    }
    for (const r of g.related || []) {
      if (genres.some((x) => x.id === r)) links.push({ source: g.id, target: r, kind: "related" });
    }
  }
  return { nodes, links };
}
