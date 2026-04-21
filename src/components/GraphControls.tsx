import { useMemo, useState } from "react";
import { FAMILIES, GENRES, type FamilyId, type Genre } from "@/data/genres";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  activeFamilies: Set<FamilyId>;
  toggleFamily: (id: FamilyId) => void;
  clearFamilies: () => void;
  onSelectGenre: (id: string) => void;
}

// "Main" subgenres = top-level genres of the family (parent is undefined or
// outside the family) plus first-level children, capped per family.
function mainSubgenres(family: FamilyId, limit = 14): Genre[] {
  const inFamily = GENRES.filter((g) => g.family === family);
  // childCount as proxy for importance
  const scored = inFamily.map((g) => ({
    g,
    score: GENRES.filter((x) => x.parents?.includes(g.id)).length,
  }));
  scored.sort((a, b) => b.score - a.score || a.g.name.localeCompare(b.g.name));
  return scored.slice(0, limit).map((s) => s.g);
}

export function GraphControls({
  search,
  setSearch,
  activeFamilies,
  toggleFamily,
  clearFamilies,
  onSelectGenre,
}: Props) {
  const [expanded, setExpanded] = useState<Set<FamilyId>>(new Set());

  const subgenresByFamily = useMemo(() => {
    const map = new Map<FamilyId, Genre[]>();
    FAMILIES.forEach((f) => map.set(f.id, mainSubgenres(f.id)));
    return map;
  }, []);

  const toggleExpand = (id: FamilyId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-20 flex h-screen w-full flex-col p-4 md:w-[320px]">
      <div className="pointer-events-auto rounded-xl border border-border bg-card/80 backdrop-blur-xl p-3 shadow-xl">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h1 className="font-mono text-sm tracking-[0.2em] text-foreground">SONOGRAPH</h1>
          <span className="text-[10px] font-mono text-muted-foreground">v0.1</span>
        </div>
        <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
          Atlas de géneros musicales. Click en un nodo para explorar.
        </p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar género…"
            className="h-8 pl-8 bg-background/60 text-sm"
          />
        </div>
      </div>

      <div className="pointer-events-auto mt-3 flex-1 overflow-y-auto rounded-xl border border-border bg-card/80 backdrop-blur-xl p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Familias
          </h2>
          {activeFamilies.size > 0 && (
            <button
              onClick={clearFamilies}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              limpiar ({activeFamilies.size})
            </button>
          )}
        </div>
        <ul className="grid grid-cols-1 gap-0.5">
          {FAMILIES.map((f) => {
            const isActive = activeFamilies.has(f.id);
            const isOpen = expanded.has(f.id);
            const dim = activeFamilies.size > 0 && !isActive;
            const subs = subgenresByFamily.get(f.id) || [];
            return (
              <li key={f.id} className="rounded-md">
                <div
                  className={cn(
                    "group flex w-full items-center gap-1 rounded-md text-left text-xs transition-colors",
                    dim ? "opacity-50" : "opacity-100"
                  )}
                >
                  <button
                    onClick={() => toggleExpand(f.id)}
                    aria-label={isOpen ? "Colapsar" : "Expandir"}
                    className="flex h-7 w-6 shrink-0 items-center justify-center rounded hover:bg-secondary"
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 text-muted-foreground transition-transform",
                        isOpen && "rotate-90"
                      )}
                    />
                  </button>
                  <button
                    onClick={() => toggleFamily(f.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-secondary",
                      isActive && "bg-secondary"
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full transition-all"
                      style={{
                        backgroundColor: f.color,
                        boxShadow: isActive ? `0 0 10px ${f.color}` : "none",
                      }}
                    />
                    <span className="flex-1 text-foreground">{f.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {GENRES.filter((g) => g.family === f.id).length}
                    </span>
                  </button>
                </div>
                {isOpen && subs.length > 0 && (
                  <ul className="ml-7 mt-0.5 mb-1.5 flex flex-wrap gap-1 border-l border-border/60 pl-2 py-1">
                    {subs.map((g) => (
                      <li key={g.id}>
                        <button
                          onClick={() => onSelectGenre(g.id)}
                          className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-secondary transition-colors"
                        >
                          {g.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
