import { useEffect, useState } from "react";
import { GENRES, FAMILY_COLOR, type Genre } from "@/data/genres";
import {
  searchArtistsByTag,
  searchRecordingsByTag,
  fetchArtistImage,
  type MBArtist,
  type MBRecording,
} from "@/lib/musicbrainz";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink, X, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  genreId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function GenreDetail({ genreId, onClose, onSelect }: Props) {
  const genre = genreId ? GENRES.find((g) => g.id === genreId) || null : null;
  const [artists, setArtists] = useState<MBArtist[]>([]);
  const [tracks, setTracks] = useState<MBRecording[]>([]);
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

    searchArtistsByTag(tag, 10)
      .then(async (list) => {
        setArtists(list);
        // Cargar imágenes en paralelo (Wikipedia)
        const entries = await Promise.all(
          list.map(async (a) => [a.id, await fetchArtistImage(a.name)] as const),
        );
        setImages(Object.fromEntries(entries));
      })
      .finally(() => setLoading(false));

    searchRecordingsByTag(tag, 12)
      .then(setTracks)
      .finally(() => setLoadingTracks(false));
  }, [genre?.id]);

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

          <Section title="Artistas (MusicBrainz)">
            {loading && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!loading && artists.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin resultados.</p>
            )}
            <ul className="space-y-1.5">
              {artists.map((a) => (
                <li key={a.id} className="text-sm">
                  <a
                    href={`https://musicbrainz.org/artist/${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                  >
                    <span>{a.name}</span>
                    {a.country && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {a.country}
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </a>
                  {a.disambiguation && (
                    <p className="text-[11px] text-muted-foreground">{a.disambiguation}</p>
                  )}
                </li>
              ))}
            </ul>
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
