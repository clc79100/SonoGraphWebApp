import { useEffect, useMemo, useState } from "react";
import {
  getArtistDetails,
  getArtistTopRecordings,
  getArtistAlbums as mbGetArtistAlbums,
  fetchArtistImage as mbFetchArtistImage,
  coverArtUrl,
} from "@/lib/musicbrainz";
import {
  getArtistById,
  getArtistAlbums as spGetArtistAlbums,
  getArtistTopTracks,
  spToUnifiedArtist,
  spToUnifiedAlbums,
  spToUnifiedTracks,
  type UnifiedArtist,
  type UnifiedAlbum,
  type UnifiedTrack,
} from "@/lib/spotify";
import {
  getArtistById as lfmGetArtistById,
  getArtistAlbums as lfmGetArtistAlbums,
  getArtistTopTracks as lfmGetArtistTopTracks,
  lfmToUnifiedArtist,
  lfmToUnifiedAlbums,
  lfmToUnifiedTracks,
} from "@/lib/lastfm";
import { fetchArtistImageByMBID, fetchArtistImageByName } from "@/lib/audiodb";
import type { DataSource } from "@/context/DataSourceContext";
import { GENRES, FAMILY_COLOR } from "@/data/genres";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink, X, Music2, Disc3, Maximize2 } from "lucide-react";

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

// Mapping MB → Unified
function mbToUnifiedArtist(d: any, image: string | null = null): UnifiedArtist {
  return {
    id: d.id,
    name: d.name,
    genres: d.genres,
    image: image,
    country: d.country,
    disambiguation: d.disambiguation,
    type: d.type,
    area: d.area,
    beginDate: d.beginDate,
    endDate: d.endDate,
  };
}

function mbToUnifiedAlbums(albums: any[]): UnifiedAlbum[] {
  return albums.map((rg) => ({
    id: rg.id,
    title: rg.title,
    imageUrl: coverArtUrl(rg.id, 250),
    year: rg.firstReleaseDate?.slice(0, 4),
    externalUrl: `https://musicbrainz.org/release-group/${rg.id}`,
  }));
}

function mbToUnifiedTracks(tracks: any[]): UnifiedTrack[] {
  return tracks.map((r) => ({
    id: r.id,
    title: r.title,
    duration: r.length,
    externalUrl: `https://musicbrainz.org/recording/${r.id}`,
  }));
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
  const [details, setDetails] = useState<UnifiedArtist | null>(null);
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [albums, setAlbums] = useState<UnifiedAlbum[]>([]);
  const [loading, setLoading] = useState(false);

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
          const unified = spToUnifiedArtist(d);
          setDetails(unified);
          setAlbums(spToUnifiedAlbums(alb));
          setTracks(spToUnifiedTracks(trks));
          onGenresResolved(matchGenresToIds(d.genres));
        }
        setLoading(false);
      });
    } else if (artistSource === "lastfm") {
      Promise.all([
        lfmGetArtistById(artistId),
        lfmGetArtistAlbums(artistId, 18),
        lfmGetArtistTopTracks(artistId, 12),
      ]).then(async ([d, alb, trks]) => {
        if (d) {
          const unified = lfmToUnifiedArtist(d);
          const lfmImage = unified.image;
          // AudioDB is the preferred image source; fall back to Last.fm image
          const audiodbImage = artistId.startsWith("name:")
            ? await fetchArtistImageByName(artistId.slice(5))
            : (await fetchArtistImageByMBID(artistId)) ??
              (await fetchArtistImageByName(unified.name));
          unified.image = audiodbImage ?? lfmImage;
          setDetails(unified);
          setAlbums(lfmToUnifiedAlbums(alb));
          setTracks(lfmToUnifiedTracks(trks));
          onGenresResolved(matchGenresToIds(unified.genres));
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      // MusicBrainz
      Promise.all([
        getArtistDetails(artistId),
        getArtistTopRecordings(artistId, 12),
        mbGetArtistAlbums(artistId, 18),
        mbFetchArtistImage(artistNameHint || ""),
      ]).then(async ([d, recs, alb, img]) => {
        if (d) {
          // AudioDB is preferred; fall back to MB/Wikipedia image
          const finalImg = (await fetchArtistImageByMBID(artistId)) ?? img;
          const unified = mbToUnifiedArtist(d, finalImg);
          setDetails(unified);
          setTracks(mbToUnifiedTracks(recs));
          setAlbums(mbToUnifiedAlbums(alb));
          onGenresResolved(matchGenresToIds(d.genres));
        }
        setLoading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, artistSource]);

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
      ? `https://open.spotify.com/artist/${artistId}`
      : artistSource === "lastfm"
      ? details?.externalUrl ||
        `https://www.last.fm/music/${encodeURIComponent(name)}`
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
                    style={{ backgroundColor: FAMILY_COLOR[g.family] }}
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
                <li key={t.id}>
                  <a
                    href={t.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-secondary/60 transition-colors"
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
                <a
                  key={alb.id}
                  href={alb.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group block w-full min-w-0"
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
