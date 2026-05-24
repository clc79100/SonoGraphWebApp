import { useEffect, useState } from "react";
import { GENRES, getFamilyColor, type Genre } from "@/data/genres";
import { useDataSource } from "@/context/DataSourceContext";
import { searchArtistsByTag as mbSearchArtistsByTag, searchRecordingsByTag as mbSearchRecordingsByTag } from "@/lib/musicbrainz";
import { searchArtistsByTag as lfmSearchArtistsByTag, searchTracksByTag as lfmSearchTracksByTag } from "@/lib/lastfm";
import { searchArtistsByGenre as spSearchArtistsByGenre, searchTracksByGenre as spSearchTracksByGenre } from "@/lib/spotify";
import type { SearchArtist, SimpleTrack } from "@/lib/spotify";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, X, Music2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  getFavoriteGenres,
  addFavoriteGenre,
  removeFavoriteGenre,
} from "@/lib/favorites";

interface GenreArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  externalUrl: string;
  imageUrl?: string;
}

interface GenreTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // ms
  externalUrl?: string;
}

interface Props {
  genreId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  musicbrainz: "MusicBrainz",
  spotify: "Spotify",
  lastfm: "Last.fm",
};

function artistExternalUrl(a: SearchArtist): string {
  if (a.source === "spotify") return `https://open.spotify.com/artist/${a.id}`;
  if (a.source === "lastfm") return `https://www.last.fm/music/${encodeURIComponent(a.name)}`;
  return `https://musicbrainz.org/artist/${a.id}`;
}

function trackExternalUrl(t: SimpleTrack, source: string): string {
  if (source === "spotify") return `https://open.spotify.com/track/${t.id}`;
  if (source === "musicbrainz") return `https://musicbrainz.org/recording/${t.id}`;
  return "#";
}

export function GenreDetail({ genreId, onClose, onSelect }: Props) {
  const { dataSource } = useDataSource();
  const { isAuthenticated } = useAuth();
  const genre = genreId ? GENRES.find((g) => g.id === genreId) || null : null;

  const [artists, setArtists] = useState<GenreArtist[]>([]);
  const [tracks, setTracks] = useState<GenreTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!genreId || !isAuthenticated) {
      setIsFavorited(false);
      return;
    }
    getFavoriteGenres()
      .then((ids) => setIsFavorited(ids.includes(genreId)))
      .catch(() => setIsFavorited(false));
  }, [genreId, isAuthenticated]);

  const toggleFavorite = async () => {
    if (!genreId) return;
    setFavLoading(true);
    try {
      if (isFavorited) {
        await removeFavoriteGenre(genreId);
        setIsFavorited(false);
      } else {
        await addFavoriteGenre(genreId);
        setIsFavorited(true);
      }
    } catch {
      // Revert on error — state unchanged
    }
    setFavLoading(false);
  };

  useEffect(() => {
    if (!genre) {
      setArtists([]);
      setTracks([]);
      return;
    }
    setLoading(true);
    setLoadingTracks(true);
    setArtists([]);
    setTracks([]);

    const gId = genre.id;

    let artistPromise: Promise<SearchArtist[]>;
    let trackPromise: Promise<SimpleTrack[]>;

    if (dataSource === "spotify") {
      artistPromise = spSearchArtistsByGenre(gId, 10).catch(() => []);
      trackPromise = spSearchTracksByGenre(gId, 12).catch(() => []);
    } else if (dataSource === "lastfm") {
      artistPromise = lfmSearchArtistsByTag(gId, 10).catch(() => []);
      trackPromise = lfmSearchTracksByTag(gId, 12).catch(() => []);
    } else {
      artistPromise = mbSearchArtistsByTag(gId, 10).catch(() => []);
      trackPromise = mbSearchRecordingsByTag(gId, 12).catch(() => []);
    }

    artistPromise
      .then((list) => {
        setArtists(
          list.map((a) => ({
            id: a.id,
            name: a.name,
            country: a.country,
            disambiguation: a.disambiguation,
            externalUrl: artistExternalUrl(a),
            imageUrl: a.image ?? undefined,
          }))
        );
      })
      .finally(() => setLoading(false));

    trackPromise
      .then((list) => {
        setTracks(
          list.map((t) => ({
            id: t.id,
            title: t.title,
            artist: t.artistName,
            duration: t.duration,
            externalUrl: trackExternalUrl(t, dataSource),
          }))
        );
      })
      .finally(() => setLoadingTracks(false));

  }, [genre?.id, dataSource]);

  if (!genre) return null;

  const parents = (genre.parents || [])
    .map((id) => GENRES.find((g) => g.id === id))
    .filter(Boolean) as Genre[];
  const children = GENRES.filter((g) => g.parents?.includes(genre.id));
  const related = (genre.related || [])
    .map((id) => GENRES.find((g) => g.id === id))
    .filter(Boolean) as Genre[];

  const color = getFamilyColor(genre.family);

  return (
    <aside className="fixed right-0 top-0 z-30 h-screen w-[360px] max-w-[88vw] border-l border-border bg-card/95 backdrop-blur-xl shadow-[-12px_0_40px_-20px_hsl(0_0%_0%/0.7)] animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
          />
          <h2 className="truncate text-sm font-semibold tracking-wide">{genre.name}</h2>
        </div>
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFavorite}
            disabled={favLoading}
            aria-label={isFavorited ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                isFavorited ? "fill-red-500 text-red-500" : "text-muted-foreground"
              }`}
            />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-49px)]">
        <div className="space-y-5 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="font-mono">{genre.family}</Badge>
            {genre.era && <Badge variant="outline">{genre.era}</Badge>}
            {genre.region && <Badge variant="outline">{genre.region}</Badge>}
          </div>

          {genre.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{genre.description}</p>
          )}

          {parents.length > 0 && (
            <Section title="Deriva de">
              <Chips items={parents} onSelect={onSelect} />
            </Section>
          )}
          {children.length > 0 && (
            <Section title={`Sub-géneros (${children.length})`}>
              <Chips items={children} onSelect={onSelect} />
            </Section>
          )}
          {related.length > 0 && (
            <Section title="Relacionados">
              <Chips items={related} onSelect={onSelect} />
            </Section>
          )}

          <Section title={`Artistas · ${SOURCE_LABEL[dataSource]}`}>
            {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!loading && artists.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin resultados.</p>
            )}
            <ul className="space-y-2">
                  {artists.map((a) => {
                const img = a.imageUrl ?? null;
                return (
                  <li key={a.id}>
                    <a
                      href={a.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-2.5 rounded-md p-1.5 -mx-1.5 hover:bg-secondary/60 transition-colors"
                    >
                      <Avatar className="h-9 w-9 border border-border shrink-0">
                        {img && <AvatarImage src={img} alt={a.name} />}
                        <AvatarFallback className="text-[10px] bg-secondary">
                          {a.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-foreground group-hover:text-primary transition-colors">
                            {a.name}
                          </span>
                          {a.country && (
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                              {a.country}
                            </span>
                          )}
                        </div>
                        {a.disambiguation && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {a.disambiguation}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-70 transition-opacity" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title={`Top canciones · ${SOURCE_LABEL[dataSource]}`}>
            {loadingTracks && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!loadingTracks && tracks.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin resultados.</p>
            )}
            <ol className="space-y-1">
              {tracks.map((t, i) => (
                <li key={t.id}>
                  <a
                    href={t.externalUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-secondary/60 transition-colors"
                  >
                    <span className="w-5 text-right font-mono text-[10px] text-muted-foreground shrink-0">
                      {i + 1}
                    </span>
                    <Music2 className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground group-hover:text-primary transition-colors">
                        {t.title}
                      </p>
                      {t.artist && (
                        <p className="truncate text-[11px] text-muted-foreground">{t.artist}</p>
                      )}
                    </div>
                    {t.duration && (
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {formatDuration(t.duration)}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </Section>

          <div className="pt-2 border-t border-border space-y-1.5">
            <a
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              href={`https://rateyourmusic.com/genre/${encodeURIComponent(genre.name)}/`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en RateYourMusic <ExternalLink className="h-3 w-3" />
            </a>
            <a
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              href={`https://everynoise.com/engenremap-${genre.id.replace(/-/g, "")}.html`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en Every Noise at Once <ExternalLink className="h-3 w-3" />
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

function Chips({ items, onSelect }: { items: Genre[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
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
    </div>
  );
}
