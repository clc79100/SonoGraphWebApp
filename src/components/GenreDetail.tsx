import { useEffect, useState } from "react";
import { GENRES, FAMILY_COLOR, type Genre } from "@/data/genres";
import { useDataSource } from "@/context/DataSourceContext";
import {
  searchArtistsByTag as mbSearchArtistsByTag,
  searchRecordingsByTag as mbSearchRecordingsByTag,
  fetchArtistImage as mbFetchArtistImage,
} from "@/lib/musicbrainz";
import {
  searchArtistsByTag as lfmSearchArtistsByTag,
  searchTracksByTag as lfmSearchTracksByTag,
} from "@/lib/lastfm";
import {
  searchArtistsByGenre as spSearchArtistsByGenre,
  searchTracksByGenre as spSearchTracksByGenre,
} from "@/lib/spotify";
import { fetchArtistImageByMBID, fetchArtistImageByName } from "@/lib/audiodb";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, X, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenreArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  externalUrl: string;
  mbid?: string;
  imageUrl?: string; // pre-loaded (Spotify only)
}

interface GenreTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number; // ms
  externalUrl: string;
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

export function GenreDetail({ genreId, onClose, onSelect }: Props) {
  const { dataSource } = useDataSource();
  const genre = genreId ? GENRES.find((g) => g.id === genreId) || null : null;

  const [artists, setArtists] = useState<GenreArtist[]>([]);
  const [tracks, setTracks] = useState<GenreTrack[]>([]);
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);

  useEffect(() => {
    if (!genre) {
      setArtists([]);
      setTracks([]);
      setImages({});
      return;
    }
    setLoading(true);
    setLoadingTracks(true);
    setArtists([]);
    setTracks([]);
    setImages({});

    const tag = genre.name.toLowerCase();

    let artistPromise: Promise<GenreArtist[]>;
    let trackPromise: Promise<GenreTrack[]>;

    if (dataSource === "spotify") {
      artistPromise = spSearchArtistsByGenre(genre.name, 10).then((list) =>
        list.map((a) => ({
          id: a.id,
          name: a.name,
          externalUrl: a.externalUrl || `https://open.spotify.com/artist/${a.id}`,
          imageUrl: a.images?.[0]?.url,
        }))
      ).catch(() => []);

      trackPromise = spSearchTracksByGenre(genre.name, 12).then((list) =>
        list.map((t) => ({
          id: t.id,
          title: t.name,
          artist: t.artistName,
          duration: t.duration_ms,
          externalUrl: `https://open.spotify.com/track/${t.id}`,
        }))
      ).catch(() => []);

    } else if (dataSource === "lastfm") {
      artistPromise = lfmSearchArtistsByTag(tag, 10).then((list) =>
        list.map((a) => ({
          id: a.mbid || `name:${a.name}`,
          name: a.name,
          externalUrl: a.url,
          mbid: a.mbid || undefined,
        }))
      ).catch(() => []);

      trackPromise = lfmSearchTracksByTag(tag, 12).then((list) =>
        list.map((t) => ({
          id: t.mbid || `lfm:${t.name}`,
          title: t.name,
          artist: t.artist?.name,
          duration: t.duration ? Number(t.duration) * 1000 : undefined,
          externalUrl: t.url,
        }))
      ).catch(() => []);

    } else {
      // MusicBrainz
      artistPromise = mbSearchArtistsByTag(tag, 10).then((list) =>
        list.map((a) => ({
          id: a.id,
          name: a.name,
          country: a.country,
          disambiguation: a.disambiguation,
          externalUrl: `https://musicbrainz.org/artist/${a.id}`,
          mbid: a.id,
        }))
      ).catch(() => []);

      trackPromise = mbSearchRecordingsByTag(tag, 12).then((list) =>
        list.map((r) => ({
          id: r.id,
          title: r.title,
          artist: r.artist,
          duration: r.length,
          externalUrl: `https://musicbrainz.org/recording/${r.id}`,
        }))
      ).catch(() => []);
    }

    artistPromise
      .then(async (list) => {
        setArtists(list);

        if (dataSource === "spotify") {
          // Spotify images come pre-loaded
          setImages(Object.fromEntries(list.map((a) => [a.id, a.imageUrl ?? null])));
        } else {
          // MB / LFM: AudioDB primary, Wikipedia fallback for MB
          const entries = await Promise.all(
            list.map(async (a) => {
              let img: string | null = null;
              if (a.mbid) {
                img = await fetchArtistImageByMBID(a.mbid);
              }
              if (!img) {
                img = await fetchArtistImageByName(a.name);
              }
              if (!img && dataSource === "musicbrainz") {
                img = await mbFetchArtistImage(a.name);
              }
              return [a.id, img] as const;
            })
          );
          setImages(Object.fromEntries(entries));
        }
      })
      .finally(() => setLoading(false));

    trackPromise.then(setTracks).finally(() => setLoadingTracks(false));

  }, [genre?.id, dataSource]);

  if (!genre) return null;

  const parents = (genre.parents || [])
    .map((id) => GENRES.find((g) => g.id === id))
    .filter(Boolean) as Genre[];
  const children = GENRES.filter((g) => g.parents?.includes(genre.id));
  const related = (genre.related || [])
    .map((id) => GENRES.find((g) => g.id === id))
    .filter(Boolean) as Genre[];

  const color = FAMILY_COLOR[genre.family];

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
                const img = images[a.id];
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
                    href={t.externalUrl}
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
            style={{ backgroundColor: FAMILY_COLOR[g.family] }}
          />
          {g.name}
        </button>
      ))}
    </div>
  );
}
