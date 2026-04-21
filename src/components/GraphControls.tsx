import { FAMILIES, type FamilyId } from "@/data/genres";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  activeFamilies: Set<FamilyId>;
  toggleFamily: (id: FamilyId) => void;
  clearFamilies: () => void;
}

export function GraphControls({
  search,
  setSearch,
  activeFamilies,
  toggleFamily,
  clearFamilies,
}: Props) {
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
              limpiar
            </button>
          )}
        </div>
        <ul className="grid grid-cols-1 gap-0.5">
          {FAMILIES.map((f) => {
            const active = activeFamilies.size === 0 || activeFamilies.has(f.id);
            return (
              <li key={f.id}>
                <button
                  onClick={() => toggleFamily(f.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    active ? "text-foreground hover:bg-secondary" : "text-muted-foreground/50 hover:bg-secondary/50"
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full transition-all"
                    style={{
                      backgroundColor: f.color,
                      boxShadow: active ? `0 0 8px ${f.color}` : "none",
                      opacity: active ? 1 : 0.4,
                    }}
                  />
                  <span className="flex-1">{f.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
