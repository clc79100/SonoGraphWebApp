import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { GENRES, FAMILY_COLOR, type Genre, type FamilyId } from "@/data/genres";

export interface GraphNode {
  id: string;
  name: string;
  family: FamilyId;
  val: number; // size
  color: string;
  genre: Genre;
}
export interface GraphLink {
  source: string;
  target: string;
  kind: "parent" | "related";
}

interface Props {
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  search: string;
  activeFamilies: Set<FamilyId>;
}

function buildGraph() {
  const nodes: GraphNode[] = GENRES.map((g) => {
    const childCount = GENRES.filter((x) => x.parents?.includes(g.id)).length;
    return {
      id: g.id,
      name: g.name,
      family: g.family,
      val: 2 + Math.sqrt(childCount + 1) * 2,
      color: FAMILY_COLOR[g.family],
      genre: g,
    };
  });
  const links: GraphLink[] = [];
  for (const g of GENRES) {
    for (const p of g.parents || []) {
      if (GENRES.some((x) => x.id === p)) links.push({ source: p, target: g.id, kind: "parent" });
    }
    for (const r of g.related || []) {
      if (GENRES.some((x) => x.id === r)) links.push({ source: g.id, target: r, kind: "related" });
    }
  }
  return { nodes, links };
}

export function GenreGraph({ width, height, selectedId, onSelect, search, activeFamilies }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const data = useMemo(buildGraph, []);

  // Highlight set for search and family filter
  const matchSet = useMemo(() => {
    const s = search.trim().toLowerCase();
    const set = new Set<string>();
    for (const n of data.nodes) {
      const inFamily = activeFamilies.size === 0 || activeFamilies.has(n.family);
      const inSearch = !s || n.name.toLowerCase().includes(s) || n.id.includes(s);
      if (inFamily && inSearch) set.add(n.id);
    }
    return set;
  }, [data.nodes, search, activeFamilies]);

  // Neighborhood of selected
  const neighborhood = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const l of data.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as any).id;
      const t = typeof l.target === "string" ? l.target : (l.target as any).id;
      if (s === selectedId) set.add(t);
      if (t === selectedId) set.add(s);
    }
    return set;
  }, [selectedId, data.links]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    // Spread out a bit
    fg.d3Force("charge")?.strength(-80);
    fg.d3Force("link")?.distance(34);
  }, []);

  useEffect(() => {
    if (!selectedId || !fgRef.current) return;
    const node = data.nodes.find((n) => n.id === selectedId) as any;
    if (node && typeof node.x === "number") {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(3.2, 600);
    }
  }, [selectedId, data.nodes]);

  return (
    <ForceGraph2D
      ref={fgRef as any}
      width={width}
      height={height}
      graphData={data}
      backgroundColor="hsl(var(--graph-bg))"
      cooldownTicks={120}
      nodeRelSize={3}
      linkColor={(l: any) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        if (selectedId && (s === selectedId || t === selectedId)) {
          return "hsla(265, 85%, 70%, 0.85)";
        }
        return "hsla(222, 12%, 30%, 0.35)";
      }}
      linkWidth={(l: any) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        return selectedId && (s === selectedId || t === selectedId) ? 1.4 : 0.5;
      }}
      onNodeClick={(n: any) => onSelect(n.id)}
      onBackgroundClick={() => onSelect(null)}
      nodeCanvasObject={(node: any, ctx, globalScale) => {
        const n = node as GraphNode & { x: number; y: number };
        const isMatch = matchSet.has(n.id);
        const isSelected = selectedId === n.id;
        const isNeighbor = neighborhood.has(n.id);
        const dim = !isMatch || (selectedId && !isNeighbor);

        const r = n.val;
        // glow for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, 2 * Math.PI);
          ctx.fillStyle = "hsla(265, 85%, 70%, 0.18)";
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = dim ? n.color.replace(")", " / 0.18)").replace("hsl(", "hsla(") : n.color;
        ctx.fill();
        if (isSelected || isNeighbor) {
          ctx.lineWidth = 1 / globalScale;
          ctx.strokeStyle = "hsla(0,0%,100%,0.7)";
          ctx.stroke();
        }

        // label
        const label = n.name;
        const fontSize = Math.max(10 / globalScale, 2.2);
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dim
          ? "hsla(210, 20%, 92%, 0.25)"
          : isSelected
          ? "hsl(210, 20%, 98%)"
          : "hsla(210, 20%, 92%, 0.85)";
        if (globalScale > 1.2 || isSelected || isNeighbor) {
          ctx.fillText(label, n.x, n.y + r + 1);
        }
      }}
      enableNodeDrag={false}
    />
  );
}
