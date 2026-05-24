import { useEffect, useRef, useState } from "react";
import { GenreGraph } from "@/components/GenreGraph";
import { GenreDetail } from "@/components/GenreDetail";
import { ArtistDetail } from "@/components/ArtistDetail";
import { ArtistExpandedView } from "@/components/ArtistExpandedView";
import { GraphControls, type SearchMode } from "@/components/GraphControls";
import type { FamilyId } from "@/data/genres";
import type { SearchArtist, UnifiedArtist, UnifiedAlbum, UnifiedTrack } from "@/lib/spotify";

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("genre");
  const [activeFamilies, setActiveFamilies] = useState<Set<FamilyId>>(new Set());
  const [selectedArtist, setSelectedArtist] = useState<SearchArtist | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [expandedArtist, setExpandedArtist] = useState<{
    details: UnifiedArtist;
    albums: UnifiedAlbum[];
    tracks: UnifiedTrack[];
  } | null>(null);

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

  const handleSelectArtist = (a: SearchArtist) => {
    setSelectedId(null);
    setSelectedArtist(a);
  };

  const handleSelectGenre = (id: string | null) => {
    setSelectedArtist(null);
    setHighlightedIds(new Set());
    setSelectedId(id);
  };

  return (
    <main
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-background"
    >
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
          onSelect={handleSelectGenre}
          onDeselectAll={() => setActiveFamilies(new Set())}
          search={searchMode === "genre" ? search : ""}
          activeFamilies={activeFamilies}
          highlightedIds={highlightedIds}
        />
      </div>

      <GraphControls
        search={search}
        setSearch={setSearch}
        searchMode={searchMode}
        setSearchMode={(m) => {
          setSearchMode(m);
          setSearch("");
          if (m === "genre") {
            setSelectedArtist(null);
            setHighlightedIds(new Set());
          }
        }}
        activeFamilies={activeFamilies}
        toggleFamily={toggleFamily}
        clearFamilies={() => setActiveFamilies(new Set())}
        onSelectGenre={(id) => handleSelectGenre(id)}
        onSelectArtist={handleSelectArtist}
        selectedGenreId={selectedId}
      />

      {selectedArtist ? (
        <ArtistDetail
          artistId={selectedArtist.id}
          artistNameHint={selectedArtist.name}
          artistSource={selectedArtist.source}
          onClose={() => {
            setSelectedArtist(null);
            setHighlightedIds(new Set());
          }}
          onSelectGenre={(id) => handleSelectGenre(id)}
          onGenresResolved={(ids) => setHighlightedIds(new Set(ids))}
          onOpenExpandedView={(data) => setExpandedArtist(data)}
        />
      ) : (
        <GenreDetail
          genreId={selectedId}
          onClose={() => setSelectedId(null)}
          onSelect={(id) => setSelectedId(id)}
        />
      )}

      {expandedArtist && (
        <ArtistExpandedView
          details={expandedArtist.details}
          albums={expandedArtist.albums}
          tracks={expandedArtist.tracks}
          onClose={() => setExpandedArtist(null)}
        />
      )}

      <footer className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-center font-mono text-[10px] tracking-wider text-muted-foreground/70">
        DATOS · CURATED + MUSICBRAINZ · ETIQUETAS RYM
      </footer>
    </main>
  );
};

export default Index;
