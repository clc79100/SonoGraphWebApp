import { useEffect, useMemo, useState } from "react";
import {
  getArtistDetails,
  getArtistTopRecordings,
  getArtistAlbums,
  fetchArtistImage,
  coverArtUrl,
  type MBArtistDetails,
  type MBRecording,
  type MBReleaseGroup,
} from "@/lib/musicbrainz";
import { GENRES, FAMILY_COLOR } from "@/data/genres";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, Music2, Disc3 } from "lucide-react";

interface Props {
  artistId: string | null;
  artistNameHint?: string;
  onClose: () => void;
  onSelectGenre: (id: string) => void;
  onGenresResolved: (ids: string[]) => void;
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
  onClose,
  onSelectGenre,
  onGenresResolved,
}: Props) {
  const [details, setDetails] = useState<MBArtistDetails | null>(null);
  const [tracks, setTracks] = useState<MBRecording[]>([]);
  const [albums, setAlbums] = useState<MBReleaseGroup[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!artistId) {
      setDetails(null);
      setTracks([]);
      setAlbums([]);
      setImage(null);
      onGenresResolved([]);
      return;
    }
    setLoading(true);
    setDetails(null);
    setTracks([]);
    setAlbums([]);
    setImage(null);

    if (artistNameHint) {
      fetchArtistImage(artistNameHint).then(setImage);
    }

    Promise.all([
      getArtistDetails(artistId),
      getArtistTopRecordings(artistId, 12),
      getArtistAlbums(artistId, 18),
    ]).then(([d, recs, alb]) => {
      setDetails(d);
      setTracks(recs);
      setAlbums(alb);
      if (d?.name && !artistNameHint) fetchArtistImage(d.name).then(setImage);
      const matched = d ? matchGenresToIds(d.genres) : [];
      onGenresResolved(matched);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId]);

  const matchedGenres = useMemo(() => {
    if (!details) return [];
    const ids = matchGenresToIds(details.genres);
    return ids
      .map((id) => GENRES.find((g) => g.id === id))
      .filter(Boolean) as typeof GENRES;
  }, [details]);

  if (!artistId) return null;
  const name = details?.name || artistNameHint || "…";

  return (
    <aside className="fixed right-0 top-0 z-30 h-screen w-[380px] max-w-[92vw] border-l border-border bg-card/95 backdrop-blur-xl shadow-[-12px_0_40px_-20px_hsl(0_0%_0%/0.7)] animate-fade-in">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Disc3 className="h-3.5 w-3.5 text-primary shrink-0" />
          <h2 className="truncate text-sm font-semibold tracking-wide">{name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-49px)]">
        <div className="space-y-5 p-4">
          {/* Hero photo */}
          <div className="relative overflow-hidden rounded-lg border border-border bg-secondary/40 aspect-square">
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-full w-full object-cover"
                onError={() => setImage(null)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-mono text-muted-foreground">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
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
              {/* Tags MB que no mapean a un nodo del grafo */}
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
                    href={`https://musicbrainz.org/recording/${t.id}`}
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
                    {t.length && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground shrink-0">
                        {formatDuration(t.length)}
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
            <div className="grid grid-cols-3 gap-2">
              {albums.map((rg) => (
                <a
                  key={rg.id}
                  href={`https://musicbrainz.org/release-group/${rg.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group block"
                  title={rg.title}
                >
                  <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-secondary/40">
                    <img
                      src={coverArtUrl(rg.id, 250)}
                      alt={rg.title}
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
                          span.textContent = rg.title.slice(0, 20);
                          parent.appendChild(span);
                        }
                      }}
                    />
                  </div>
                  <p className="mt-1 truncate text-[10px] text-foreground/90 group-hover:text-primary transition-colors">
                    {rg.title}
                  </p>
                  {rg.firstReleaseDate && (
                    <p className="truncate font-mono text-[9px] text-muted-foreground">
                      {rg.firstReleaseDate.slice(0, 4)}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </Section>

          <div className="pt-2 border-t border-border">
            <a
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              href={`https://musicbrainz.org/artist/${artistId}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en MusicBrainz <ExternalLink className="h-3 w-3" />
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
