import { useEffect, useMemo, useRef, useState } from "react";
import { FAMILIES, GENRES, type FamilyId, type Genre } from "@/data/genres";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, Loader2, User, Disc3 } from "lucide-react";
import { SiMusicbrainz, SiSpotify, SiLastdotfm } from "@icons-pack/react-simple-icons";
import { cn } from "@/lib/utils";
import { searchArtistsByName } from "@/lib/musicbrainz";
import { searchArtistByName as spSearchArtistByName, SpotifyAPIError, type SearchArtist } from "@/lib/spotify";
import { searchArtistByName as lfmSearchArtistByName, LastfmAPIError } from "@/lib/lastfm";
import { useDataSource } from "@/context/DataSourceContext";
import { useAuth } from "@/context/AuthContext";
import { AuthModal } from "@/components/AuthModal";

export type SearchMode = "genre" | "artist";

interface Props {
  search: string;
  setSearch: (v: string) => void;
  searchMode: SearchMode;
  setSearchMode: (m: SearchMode) => void;
  activeFamilies: Set<FamilyId>;
  toggleFamily: (id: FamilyId) => void;
  clearFamilies: () => void;
  onSelectGenre: (id: string) => void;
  onSelectArtist: (artist: SearchArtist) => void;
  selectedGenreId?: string | null;
}

function mainSubgenres(family: FamilyId, limit = 14): Genre[] {
  const inFamily = GENRES.filter((g) => g.family === family);
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
  searchMode,
  setSearchMode,
  activeFamilies,
  toggleFamily,
  clearFamilies,
  onSelectGenre,
  onSelectArtist,
  selectedGenreId,
}: Props) {
  const { dataSource, setDataSource } = useDataSource();
  const { user, isAuthenticated, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<FamilyId>>(new Set());
  const [artistResults, setArtistResults] = useState<SearchArtist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const familyItemRefs = useRef<Partial<Record<FamilyId, HTMLLIElement | null>>>({});

  const subgenresByFamily = useMemo(() => {
    const map = new Map<FamilyId, Genre[]>();
    FAMILIES.forEach((f) => map.set(f.id, mainSubgenres(f.id)));
    return map;
  }, []);

  // Búsqueda debounced según fuente activa
  useEffect(() => {
    if (searchMode !== "artist") {
      setArtistResults([]);
      setArtistError(null);
      setLoadingArtists(false);
      return;
    }
    const q = search.trim();
    if (q.length < 2) {
      setArtistResults([]);
      setArtistError(null);
      setLoadingArtists(false);
      return;
    }
    setLoadingArtists(true);
    setArtistError(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        if (dataSource === "spotify") {
          const list = await spSearchArtistByName(q, 10);
          setArtistResults(
            list.map((a) => ({
              id: a.id,
              name: a.name,
              disambiguation: a.popularity != null ? `popularidad ${a.popularity}` : undefined,
              source: "spotify" as const,
            }))
          );
        } else if (dataSource === "lastfm") {
          const list = await lfmSearchArtistByName(q, 10);
          setArtistResults(
            list.map((a) => ({
              id: a.mbid && a.mbid.length > 0 ? a.mbid : `name:${a.name}`,
              name: a.name,
              disambiguation: a.listeners
                ? `${Number(a.listeners).toLocaleString()} oyentes`
                : undefined,
              source: "lastfm" as const,
            }))
          );
        } else {
          const list = await searchArtistsByName(q, 10);
          setArtistResults(
            list.map((a) => ({
              id: a.id,
              name: a.name,
              country: a.country,
              disambiguation: a.disambiguation,
              source: "musicbrainz" as const,
            }))
          );
        }
      } catch (err) {
        if (err instanceof SpotifyAPIError && err.code === "premium_required") {
          setArtistError("Spotify requiere cuenta Premium activa en el panel de desarrollador.");
        } else if (err instanceof LastfmAPIError) {
          setArtistError(
            err.code === "no_credentials"
              ? "Falta VITE_LASTFM_API_KEY en .env."
              : "Error al conectar con Last.fm."
          );
        } else {
          setArtistError("Error al conectar con la fuente seleccionada.");
        }
        setArtistResults([]);
      }
      setLoadingArtists(false);
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search, searchMode, dataSource]);

  // Limpiar resultados al cambiar fuente
  useEffect(() => {
    setArtistResults([]);
    setArtistError(null);
  }, [dataSource]);

  // When a genre is selected, open its family (close others) and scroll to it
  useEffect(() => {
    if (!selectedGenreId) {
      setExpanded(new Set());
      return;
    }
    const genre = GENRES.find((g) => g.id === selectedGenreId);
    if (!genre) return;
    setExpanded(new Set([genre.family]));
    // Wait for DOM update then scroll the family row into view
    requestAnimationFrame(() => {
      familyItemRefs.current[genre.family]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [selectedGenreId]);

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
          <div className="flex items-center gap-1.5">
            {isAuthenticated ? (
              <button
                onClick={logout}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                title="Cerrar sesión"
              >
                {user?.email ?? "Sesión"}
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Iniciar sesión
              </button>
            )}
            <span className="text-[10px] font-mono text-muted-foreground">v0.1</span>
          </div>
        </div>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />

        {/* Modo búsqueda toggle */}
        <div className="mb-2 flex rounded-md border border-border bg-background/40 p-0.5 text-[11px] font-mono">
          {(
            [
              { id: "genre", label: "Género", Icon: Disc3 },
              { id: "artist", label: "Artista", Icon: User },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSearchMode(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1 transition-colors",
                searchMode === id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          {loadingArtists ? (
            <Loader2 className="pointer-events-none absolute left-2.5 top-[14px] h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchMode === "genre" ? "Buscar género…" : "Buscar artista…"}
            className="h-8 pl-8 bg-background/60 text-sm"
          />
        </div>

        {/* Resultados de búsqueda de artista */}
        {searchMode === "artist" && search.trim().length >= 2 && (
          <div className="mt-2 max-h-[260px] overflow-y-auto rounded-md border border-border bg-background/60">
            {artistError && (
              <p className="px-2 py-2 text-[11px] text-destructive/90 leading-snug">{artistError}</p>
            )}
            {!loadingArtists && !artistError && artistResults.length === 0 && (
              <p className="px-2 py-2 text-[11px] text-muted-foreground">Sin resultados.</p>
            )}
            <ul className="divide-y divide-border/40">
              {artistResults.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => onSelectArtist(a)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs text-foreground">{a.name}</span>
                        {a.country && (
                          <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                            {a.country}
                          </span>
                        )}
                      </div>
                      {a.disambiguation && (
                        <p className="truncate text-[10px] text-muted-foreground">
                          {a.disambiguation}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          {searchMode === "genre"
            ? "Atlas de géneros. Click en un nodo para explorar."
            : "Busca un artista para iluminar sus géneros en el grafo."}
        </p>

        {/* Selector de fuente de datos */}
        <div className="mt-3 border-t border-border/60 pt-3">
          <p className="mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Fuente
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {/* MusicBrainz */}
            <button
              onClick={() => setDataSource("musicbrainz")}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all duration-200",
                dataSource === "musicbrainz"
                  ? "border-transparent text-foreground"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground bg-background/20",
              )}
              style={
                dataSource === "musicbrainz"
                  ? {
                      background: "linear-gradient(90deg, rgba(186,71,143,0.2) 0%, rgba(235,116,59,0.2) 100%)",
                      boxShadow: "-6px 0 18px 2px rgba(186,71,143,0.5), 6px 0 18px 2px rgba(235,116,59,0.5)",
                      borderColor: "rgba(186,71,143,0.55)",
                    }
                  : undefined
              }
            >
              <SiMusicbrainz
                size={22}
                style={
                  dataSource === "musicbrainz"
                    ? { color: "#eb743b" }
                    : { opacity: 0.45 }
                }
              />
              <span className="text-[9px] font-mono tracking-wide">MusicBrainz</span>
            </button>

            {/* Spotify */}
            <button
              onClick={() => setDataSource("spotify")}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all duration-200",
                dataSource === "spotify"
                  ? "border-transparent text-foreground"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground bg-background/20",
              )}
              style={
                dataSource === "spotify"
                  ? {
                      background: "rgba(23,216,96,0.12)",
                      boxShadow: "0 0 16px 4px rgba(23,216,96,0.45)",
                      borderColor: "rgba(23,216,96,0.5)",
                    }
                  : undefined
              }
            >
              <SiSpotify
                size={22}
                style={
                  dataSource === "spotify"
                    ? { color: "#17d860" }
                    : { opacity: 0.45 }
                }
              />
              <span className="text-[9px] font-mono tracking-wide">Spotify</span>
            </button>

            {/* Last.fm */}
            <button
              onClick={() => setDataSource("lastfm")}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-all duration-200",
                dataSource === "lastfm"
                  ? "border-transparent text-foreground"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground bg-background/20",
              )}
              style={
                dataSource === "lastfm"
                  ? {
                      background: "rgba(208,35,43,0.12)",
                      boxShadow: "0 0 16px 4px rgba(208,35,43,0.45)",
                      borderColor: "rgba(208,35,43,0.5)",
                    }
                  : undefined
              }
            >
              <SiLastdotfm
                size={22}
                style={
                  dataSource === "lastfm"
                    ? { color: "#d0232b" }
                    : { opacity: 0.45 }
                }
              />
              <span className="text-[9px] font-mono tracking-wide">Last.fm</span>
            </button>
          </div>
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
              <li key={f.id} className="rounded-md" ref={(el) => { familyItemRefs.current[f.id] = el; }}>
                <div
                  className={cn(
                    "group flex w-full items-center gap-1 rounded-md text-left text-xs transition-colors",
                    dim ? "opacity-50" : "opacity-100",
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
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>
                  <button
                    onClick={() => toggleFamily(f.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-secondary",
                      isActive && "bg-secondary",
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

