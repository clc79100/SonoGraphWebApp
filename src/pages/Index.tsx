import { useEffect, useRef, useState } from "react";
import { GenreGraph } from "@/components/GenreGraph";
import { GenreDetail } from "@/components/GenreDetail";
import { GraphControls } from "@/components/GraphControls";
import type { FamilyId } from "@/data/genres";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFamilies, setActiveFamilies] = useState<Set<FamilyId>>(new Set());

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setSize({
        w: containerRef.current.clientWidth,
        h: containerRef.current.clientHeight,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const toggleFamily = (id: FamilyId) => {
    setActiveFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-background"
    >
      {/* Subtle radial glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, hsl(265 85% 12% / 0.6), transparent 60%), radial-gradient(ellipse at 70% 80%, hsl(195 90% 12% / 0.5), transparent 55%)",
        }}
      />

      <div className="absolute inset-0 z-10">
        <GenreGraph
          width={size.w}
          height={size.h}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          activeFamilies={activeFamilies}
        />
      </div>

      <GraphControls
        search={search}
        setSearch={setSearch}
        activeFamilies={activeFamilies}
        toggleFamily={toggleFamily}
        clearFamilies={() => setActiveFamilies(new Set())}
        onSelectGenre={setSelectedId}
      />

      <GenreDetail
        genreId={selectedId}
        onClose={() => setSelectedId(null)}
        onSelect={(id) => setSelectedId(id)}
      />

      <footer className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-center font-mono text-[10px] tracking-wider text-muted-foreground/70">
        DATOS · CURATED + MUSICBRAINZ · ETIQUETAS RYM
      </footer>
    </main>
  );
};

export default Index;
