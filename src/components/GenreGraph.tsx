import { useEffect, useMemo, useRef, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { GENRES, getFamilyColor, type Genre, type FamilyId } from "@/data/genres";

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
  onDeselectAll?: () => void;
  search: string;
  activeFamilies: Set<FamilyId>;
  highlightedIds?: Set<string>;
}

function buildGraph() {
  const nodes: GraphNode[] = GENRES.map((g) => {
    const childCount = GENRES.filter((x) => x.parents?.includes(g.id)).length;
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

export function GenreGraph({ width, height, selectedId, onSelect, onDeselectAll, search, activeFamilies, highlightedIds }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const data = useMemo(buildGraph, []);

  // Grab canvas reference after first render for cursor control
  useEffect(() => {
    canvasRef.current = document.querySelector("canvas");
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? "pointer" : "default";
    }
  }, []);

  // Highlight set for search and family filter (and artist highlights)
  const matchSet = useMemo(() => {
    const s = search.trim().toLowerCase();
    const set = new Set<string>();
    for (const n of data.nodes) {
      const inFamily = activeFamilies.size === 0 || activeFamilies.has(n.family);
      const inSearch = !s || n.name.toLowerCase().includes(s) || n.id.includes(s);
      if (inFamily && inSearch) set.add(n.id);
    }
    if (highlightedIds && highlightedIds.size > 0) {
      for (const id of highlightedIds) set.add(id);
    }
    return set;
  }, [data.nodes, search, activeFamilies, highlightedIds]);

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
      onNodeHover={handleNodeHover}
      onBackgroundClick={() => { onSelect(null); onDeselectAll?.(); }}
      nodeCanvasObject={(node: any, ctx, globalScale) => {
        const n = node as GraphNode & { x: number; y: number };
        const isMatch = matchSet.has(n.id);
        const isSelected = selectedId === n.id;
        const isNeighbor = neighborhood.has(n.id);
        const isHighlighted = !!highlightedIds && highlightedIds.has(n.id);
        const dim = !isMatch || (selectedId && !isNeighbor && !isSelected && !isHighlighted);

        // Resolve actual color (CSS var → rgba) once per draw
        const baseColor = (() => {
          if (typeof document === "undefined") return n.color;
          const m = n.color.match(/var\((--[\w-]+)\)/);
          if (!m) return n.color;
          const val = getComputedStyle(document.documentElement)
            .getPropertyValue(m[1])
            .trim();
          return val ? `hsl(${val})` : n.color;
        })();
        const dimColor = baseColor.startsWith("hsl(")
          ? baseColor.replace("hsl(", "hsla(").replace(")", ", 0.15)")
          : baseColor;

        const r = n.val;

        // Glow via canvas shadow — node's own color, no white border ring
        if (isSelected) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 24;
        } else if (isNeighbor && selectedId) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 13;
        } else if (isHighlighted) {
          ctx.shadowColor = "hsla(195, 90%, 65%, 0.95)";
          ctx.shadowBlur = 16;
        }

        // Selected node renders slightly larger
        const drawR = isSelected ? r * 1.3 : r;
        ctx.beginPath();
        ctx.arc(n.x, n.y, drawR, 0, 2 * Math.PI);
        ctx.fillStyle = dim ? dimColor : baseColor;
        ctx.fill();

        // Reset shadow so it doesn't bleed into labels
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";

        // Cyan ring only for artist-matched highlights
        if (isHighlighted) {
          ctx.lineWidth = 1.6 / globalScale;
          ctx.strokeStyle = "hsla(195, 95%, 75%, 0.95)";
          ctx.stroke();
        }

        const label = n.name;
        const fontSize = Math.max(10 / globalScale, 2.2);
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dim
          ? "hsla(210, 20%, 92%, 0.18)"
          : isSelected
          ? "hsl(210, 20%, 98%)"
          : "hsla(210, 20%, 92%, 0.9)";
        if (globalScale > 1.2 || isSelected || isNeighbor || (isMatch && matchSet.size < 30)) {
          ctx.fillText(label, n.x, n.y + r + 1);
        }
      }}
      enableNodeDrag={false}
    />
  );
}
