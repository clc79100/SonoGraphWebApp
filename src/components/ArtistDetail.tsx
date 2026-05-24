import { useEffect, useMemo, useState } from "react";
import {
  getArtistDetails,
  getArtistTopRecordings,
  getArtistAlbums as mbGetArtistAlbums,
} from "@/lib/musicbrainz";
import {
  getArtistById,
  getArtistAlbums as spGetArtistAlbums,
  getArtistTopTracks,
  type UnifiedArtist,
  type UnifiedAlbum,
  type UnifiedTrack,
} from "@/lib/spotify";
import {
  getArtistById as lfmGetArtistById,
  getArtistAlbums as lfmGetArtistAlbums,
  getArtistTopTracks as lfmGetArtistTopTracks,
} from "@/lib/lastfm";
import type { DataSource } from "@/context/DataSourceContext";
import { GENRES, getFamilyColor } from "@/data/genres";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, X, Music2, Disc3, Maximize2, Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  getFavoriteArtists,
  addFavoriteArtist,
  removeFavoriteArtist,
  getFavoriteTracks,
  addFavoriteTrack,
  removeFavoriteTrack,
  getFavoriteAlbums,
  addFavoriteAlbum,
  removeFavoriteAlbum,
  type FavoriteTrack,
  type FavoriteAlbum,
  type FavoriteArtist,
} from "@/lib/favorites";

interface Props {
  artistId: string | null;
  artistNameHint?: string;
  artistSource?: DataSource;
  onClose: () => void;
  onSelectGenre: (id: string) => void;
  onGenresResolved: (ids: string[]) => void;
  onOpenExpandedView?: (data: {
    details: UnifiedArtist;
    albums: UnifiedAlbum[];
    tracks: UnifiedTrack[];
  }) => void;
}

function matchGenresToIds(names: string[]): string[] {
  if (!names.length) return [];
  const lower = new Set(names.map((s) => s.toLowerCase().trim()));
  const out: string[] = [];
  for (const g of GENRES) {
    if (lower.has(g.name.toLowerCase()) || lower.has(g.id.replace(/-/g, " "))) {
      out.push(g.id);
    }
  }
  return out;
}

export function ArtistDetail({
  artistId,
  artistNameHint,
  artistSource = "musicbrainz",
  onClose,
  onSelectGenre,
  onGenresResolved,
  onOpenExpandedView,
}: Props) {
  const { isAuthenticated } = useAuth();

  const [details, setDetails] = useState<UnifiedArtist | null>(null);
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [albums, setAlbums] = useState<UnifiedAlbum[]>([]);
  const [loading, setLoading] = useState(false);

  // Favorites state
  const [favArtists, setFavArtists] = useState<Map<string, FavoriteArtist>>(new Map());
  const [favTracks, setFavTracks] = useState<Map<string, FavoriteTrack>>(new Map());
  const [favAlbums, setFavAlbums] = useState<Map<string, FavoriteAlbum>>(new Map());
  const [favArtistLoading, setFavArtistLoading] = useState(false);
  const [favTrackLoading, setFavTrackLoading] = useState<Set<string>>(new Set());
  const [favAlbumLoading, setFavAlbumLoading] = useState<Set<string>>(new Set());

  // Load favorites on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setFavArtists(new Map());
      setFavTracks(new Map());
      setFavAlbums(new Map());
      return;
    }
    Promise.all([
      getFavoriteArtists().then((list) => new Map(list.map((f) => [f.externalId, f]))),
      getFavoriteTracks().then((list) => new Map(list.map((f) => [f.externalId, f]))),
      getFavoriteAlbums().then((list) => new Map(list.map((f) => [f.externalId, f]))),
    ]).then(([artists, trks, albs]) => {
      setFavArtists(artists);
      setFavTracks(trks);
      setFavAlbums(albs);
    }).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!artistId) {
      setDetails(null);
      setTracks([]);
      setAlbums([]);
      onGenresResolved([]);
      return;
    }
    setLoading(true);
    setDetails(null);
    setTracks([]);
    setAlbums([]);

    if (artistSource === "spotify") {
      Promise.all([
        getArtistById(artistId),
        spGetArtistAlbums(artistId, 18),
        getArtistTopTracks(artistId),
      ]).then(([d, alb, trks]) => {
        if (d) {
          setDetails(d);
          setAlbums(alb);
          setTracks(trks);
          onGenresResolved(matchGenresToIds(d.genres));
        }
        setLoading(false);
      }).catch(() => setLoading(false));

    } else if (artistSource === "lastfm") {
      Promise.all([
        lfmGetArtistById(artistId),
        lfmGetArtistAlbums(artistId, 18),
        lfmGetArtistTopTracks(artistId, 12),
      ]).then(([d, alb, trks]) => {
        if (d) {
          setDetails(d);
          setAlbums(alb);
          setTracks(trks);
          onGenresResolved(matchGenresToIds(d.genres));
        }
        setLoading(false);
      }).catch(() => setLoading(false));

    } else {
      // MusicBrainz
      Promise.all([
        getArtistDetails(artistId),
        getArtistTopRecordings(artistId, 12),
        mbGetArtistAlbums(artistId, 18),
      ]).then(([d, recs, alb]) => {
        if (d) {
          setDetails(d);
          setTracks(recs);
          setAlbums(alb);
          onGenresResolved(matchGenresToIds(d.genres));
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, artistSource]);

  const toggleArtistFav = async () => {
    if (!details || !artistId) return;
    setFavArtistLoading(true);
    try {
      if (favArtists.has(artistId)) {
        const existing = favArtists.get(artistId)!;
        await removeFavoriteArtist(existing.id);
        setFavArtists((prev) => { const m = new Map(prev); m.delete(artistId); return m; });
      } else {
        await addFavoriteArtist({
          externalId: artistId,
          name: details.name,
          imageUrl: details.image ?? undefined,
          source: artistSource,
        });
        const updated = await getFavoriteArtists();
        setFavArtists(new Map(updated.map((f) => [f.externalId, f])));
      }
    } catch {}
    setFavArtistLoading(false);
  };

  const toggleTrackFav = async (track: UnifiedTrack) => {
    setFavTrackLoading((prev) => new Set(prev).add(track.id));
    try {
      if (favTracks.has(track.id)) {
        const existing = favTracks.get(track.id)!;
        await removeFavoriteTrack(existing.id);
        setFavTracks((prev) => { const m = new Map(prev); m.delete(track.id); return m; });
      } else {
        await addFavoriteTrack({
          externalId: track.id,
          title: track.title,
          artistName: details?.name,
          source: artistSource,
        });
        const updated = await getFavoriteTracks();
        setFavTracks(new Map(updated.map((f) => [f.externalId, f])));
      }
    } catch {}
    setFavTrackLoading((prev) => { const s = new Set(prev); s.delete(track.id); return s; });
  };

  const toggleAlbumFav = async (album: UnifiedAlbum) => {
    setFavAlbumLoading((prev) => new Set(prev).add(album.id));
    try {
      if (favAlbums.has(album.id)) {
        const existing = favAlbums.get(album.id)!;
        await removeFavoriteAlbum(existing.id);
        setFavAlbums((prev) => { const m = new Map(prev); m.delete(album.id); return m; });
      } else {
        await addFavoriteAlbum({
          externalId: album.id,
          title: album.title,
          artistName: details?.name,
          imageUrl: album.imageUrl,
          source: artistSource,
        });
        const updated = await getFavoriteAlbums();
        setFavAlbums(new Map(updated.map((f) => [f.externalId, f])));
      }
    } catch {}
    setFavAlbumLoading((prev) => { const s = new Set(prev); s.delete(album.id); return s; });
  };

  const matchedGenres = useMemo(() => {
    if (!details) return [];
    return matchGenresToIds(details.genres)
      .map((id) => GENRES.find((g) => g.id === id))
      .filter(Boolean) as typeof GENRES;
  }, [details]);

  if (!artistId) return null;
  const name = details?.name || artistNameHint || "…";
  const image = details?.image;

  const externalUrl =
    artistSource === "spotify"
      ? details?.externalUrl || `https://open.spotify.com/artist/${artistId}`
      : artistSource === "lastfm"
      ? details?.externalUrl || `https://www.last.fm/music/${encodeURIComponent(name)}`
      : `https://musicbrainz.org/artist/${artistId}`;

  const externalLabel =
    artistSource === "spotify"
      ? "Ver en Spotify"
      : artistSource === "lastfm"
      ? "Ver en Last.fm"
      : "Ver en MusicBrainz";

  return (
    <aside className="fixed right-0 top-0 z-30 h-screen w-[380px] max-w-[92vw] border-l border-border bg-card/95 backdrop-blur-xl shadow-[-12px_0_40px_-20px_hsl(0_0%_0%/0.7)] animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Disc3 className="h-3.5 w-3.5 text-primary shrink-0" />
          <h2 className="truncate text-sm font-semibold tracking-wide">{name}</h2>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase",
              artistSource === "spotify"
                ? "bg-green-900/40 text-green-400"
                : artistSource === "lastfm"
                ? "bg-red-900/40 text-red-400"
                : "bg-orange-900/40 text-orange-400"
            )}
          >
            {artistSource === "spotify" ? "SP" : artistSource === "lastfm" ? "LF" : "MB"}
          </span>
        </div>
        <div className="flex gap-1">
          {isAuthenticated && details && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleArtistFav}
              disabled={favArtistLoading}
              aria-label={favArtists.has(artistId ?? "") ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              <Heart
                className={`h-4 w-4 transition-colors ${
                  favArtists.has(artistId ?? "")
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
          )}
          {onOpenExpandedView && details && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                onOpenExpandedView({ details, albums, tracks })
              }
              aria-label="Expandir"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-49px)]">
        <div className="space-y-5 p-4">
          {/* Avatar circular */}
          <div className="flex justify-center">
            <Avatar className="h-24 w-24 border-2 border-border shadow-md">
              <AvatarImage
                src={image ?? undefined}
                alt={name}
                onError={() => setDetails((prev) => prev ? { ...prev, image: null } : null)}
              />
              <AvatarFallback className="text-lg">
                {name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div>
            <h1 className="text-xl font-semibold leading-tight">{name}</h1>
            {details?.disambiguation && (
              <p className="text-xs text-muted-foreground mt-0.5">{details.disambiguation}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {details?.type && <Badge variant="secondary" className="font-mono">{details.type}</Badge>}
              {details?.area && <Badge variant="outline">{details.area}</Badge>}
              {details?.country && <Badge variant="outline" className="font-mono">{details.country}</Badge>}
              {details?.beginDate && (
                <Badge variant="outline" className="font-mono">
                  {details.beginDate}
                  {details.endDate ? ` – ${details.endDate}` : ""}
                </Badge>
              )}
            </div>
          </div>

          <Section title={`Géneros${matchedGenres.length ? ` (${matchedGenres.length})` : ""}`}>
            {loading && !details && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {details && details.genres.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin géneros etiquetados.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {matchedGenres.map((g) => (
                <button
                  key={g.id}
                  onClick={() => onSelectGenre(g.id)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs hover:bg-secondary hover:border-primary/50 transition-colors"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getFamilyColor(g.family) }}
                  />
                  {g.name}
                </button>
              ))}
              {details?.genres
                .filter((n) => !matchedGenres.some((g) => g.name.toLowerCase() === n))
                .slice(0, 12)
                .map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center rounded-full border border-dashed border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {n}
                  </span>
                ))}
            </div>
          </Section>

          <Section title="Top canciones">
            {loading && tracks.length === 0 && (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            )}
            {!loading && tracks.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin resultados.</p>
            )}
            <ol className="space-y-1">
              {tracks.map((t, i) => (
                <li key={t.id} className="group flex items-center gap-1 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-secondary/60 transition-colors">
                  {isAuthenticated && (
                    <button
                      onClick={(e) => { e.preventDefault(); toggleTrackFav(t); }}
                      disabled={favTrackLoading.has(t.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      aria-label={favTracks.has(t.id) ? "Quitar" : "Añadir"}
                    >
                      <Heart
                        className={`h-3 w-3 ${
                          favTracks.has(t.id)
                            ? "fill-red-500 text-red-500"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  )}
                  <a
                    href={t.externalUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center gap-2 min-w-0"
                  >
                    <span className="w-5 text-right font-mono text-[10px] text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <Music2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate text-sm text-foreground group-hover:text-primary transition-colors">
                      {t.title}
                    </span>
                    {t.duration && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground shrink-0">
                        {formatDuration(t.duration)}
                      </span>
                    )}
                    {t.album && (
                      <span className="ml-1 truncate max-w-[80px] font-mono text-[9px] text-muted-foreground/70 shrink-0">
                        {t.album}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </Section>

          <Section title={`Álbumes${albums.length ? ` (${albums.length})` : ""}`}>
            {loading && albums.length === 0 && (
              <p className="text-xs text-muted-foreground">Cargando…</p>
            )}
            {!loading && albums.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin álbumes.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {albums.map((alb) => (
                <div key={alb.id} className="group relative">
                  <a
                    href={alb.externalUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full min-w-0"
                    title={alb.title}
                  >
                    <div className="relative aspect-square w-full min-w-0 overflow-hidden rounded-md border border-border bg-secondary/40">
                      {alb.imageUrl ? (
                        <img
                          src={alb.imageUrl}
                          alt={alb.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const parent = el.parentElement;
                            if (parent && !parent.querySelector(".no-art")) {
                              const span = document.createElement("span");
                              span.className =
                                "no-art absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground p-1 text-center";
                              span.textContent = alb.title.slice(0, 20);
                              parent.appendChild(span);
                            }
                          }}
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground p-1 text-center">
                          {alb.title.slice(0, 20)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-foreground/90 group-hover:text-primary transition-colors line-clamp-2">
                      {alb.title}
                    </p>
                    {alb.year && (
                      <p className="truncate font-mono text-[9px] text-muted-foreground">{alb.year}</p>
                    )}
                  </a>
                  {isAuthenticated && (
                    <button
                      onClick={() => toggleAlbumFav(alb)}
                      disabled={favAlbumLoading.has(alb.id)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={favAlbums.has(alb.id) ? "Quitar" : "Añadir"}
                    >
                      <Heart
                        className={`h-4 w-4 drop-shadow-md ${
                          favAlbums.has(alb.id)
                            ? "fill-red-500 text-red-500"
                            : "text-white"
                        }`}
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <div className="pt-2 border-t border-border">
            <a
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
            >
              {externalLabel} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
