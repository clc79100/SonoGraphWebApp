import { useEffect, useState } from "react";
import { X, Music2, Disc3 } from "lucide-react";
import type { UnifiedArtist, UnifiedAlbum, UnifiedTrack } from "@/lib/spotify";

interface Props {
  details: UnifiedArtist;
  albums: UnifiedAlbum[];
  tracks: UnifiedTrack[];
  onClose: () => void;
}

export function ArtistExpandedView({ details, albums, tracks, onClose }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!details.image) {
      // No hero image — just wait a frame for layout
      const t = setTimeout(() => setReady(true), 300);
      return () => clearTimeout(t);
    }
    // Preload hero image, then reveal
    const img = new Image();
    img.onload = () => setReady(true);
    img.onerror = () => setReady(true);
    img.src = details.image;
    // Safety timeout in case image hangs
    const timeout = setTimeout(() => setReady(true), 4000);
    return () => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
    };
  }, [details.image]);

  // Album covers with actual images, used as cycling fallback
  const albumsWithArt = albums.filter((a) => a.imageUrl);

  // Resolve cover for a track: own albumImageUrl → name-match → cyclic album fallback
  const artForTrack = (track: UnifiedTrack, idx: number): string | undefined => {
    if (track.albumImageUrl) return track.albumImageUrl;
    if (track.album) {
      const match = albumsWithArt.find(
        (a) => a.title.toLowerCase() === track.album!.toLowerCase()
      );
      if (match) return match.imageUrl;
    }
    // Fallback: cycle through available album covers so every track has art
    if (albumsWithArt.length > 0) {
      return albumsWithArt[idx % albumsWithArt.length].imageUrl;
    }
    return undefined;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-[92vw] max-w-5xl h-[88vh] rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
        style={{ background: "hsl(222 18% 7%)" }}
      >
        {/* Close button — always visible */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/80 hover:bg-black/80 hover:text-white transition-colors backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── LOADING OVERLAY ── */}
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            style={{ background: "hsl(222 18% 7%)" }}
          >
            <div className="relative h-14 w-14">
              {/* Spinner rings */}
              <div className="absolute inset-0 rounded-full border-2 border-white/8" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/70 animate-spin" />
              <div className="absolute inset-[5px] rounded-full border border-transparent border-t-primary/50 animate-spin [animation-duration:1.4s]" />
            </div>
            <p className="text-[11px] font-mono tracking-widest text-muted-foreground/50 uppercase">
              {details.name}
            </p>
          </div>
        )}

        {/* ── CONTENT (fade in when ready) ── */}
        <div
          className="h-full overflow-y-auto transition-opacity duration-500"
          style={{ opacity: ready ? 1 : 0, pointerEvents: ready ? "auto" : "none" }}
        >
          {/* ── HERO ── */}
          <div className="relative h-[42vh] min-h-[200px] overflow-hidden">
            {details.image ? (
              <img
                src={details.image}
                alt={details.name}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_18%_7%)] via-[hsl(222_18%_7%/0.25)] to-[hsl(222_18%_7%/0.55)]" />
            <div className="absolute bottom-0 left-0 right-0 px-8 pb-6">
              <h1 className="text-4xl font-bold uppercase tracking-tight text-white drop-shadow-lg leading-none">
                {details.name}
              </h1>
              {(details.disambiguation || details.area || details.country) && (
                <p className="mt-1.5 text-[11px] text-white/55 font-mono tracking-wider">
                  {[details.disambiguation, details.area, details.country]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* ── TOP CANCIONES ── */}
          {tracks.length > 0 && (
            <section className="px-8 pt-7 pb-6">
              <h2 className="text-base font-bold text-foreground mb-4">Top Canciones</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 lg:grid-cols-4">
                {tracks.slice(0, 12).map((track, idx) => {
                  const art = artForTrack(track, idx);
                  return (
                    <a
                      key={track.id}
                      href={track.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5 transition-colors"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md shadow-sm">
                        {art ? (
                          <img
                            src={art}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-secondary/60">
                            <Music2 className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
                          {track.title}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
                          {[track.album, track.duration ? formatDuration(track.duration) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {tracks.length > 0 && albums.length > 0 && (
            <div className="mx-8 border-t border-border/30" />
          )}

          {/* ── ÁLBUMES ── */}
          {albums.length > 0 && (
            <section className="px-8 pt-6 pb-8">
              <h2 className="text-base font-bold text-foreground mb-4">
                Álbumes
                <span className="ml-2 text-xs font-normal text-muted-foreground/60">
                  {albums.length}
                </span>
              </h2>
              <div className="grid grid-cols-4 gap-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
                {albums.map((alb) => (
                  <a
                    key={alb.id}
                    href={alb.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group block"
                    title={alb.title}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-secondary/40 shadow-md transition-transform duration-200 group-hover:scale-105 group-hover:shadow-xl">
                      {alb.imageUrl ? (
                        <img
                          src={alb.imageUrl}
                          alt={alb.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Disc3 className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[11px] font-medium text-foreground/90 group-hover:text-primary transition-colors leading-tight">
                      {alb.title}
                    </p>
                    {alb.year && (
                      <p className="truncate text-[10px] text-muted-foreground/55 font-mono">
                        {alb.year}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {tracks.length === 0 && albums.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50">
              <Music2 className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin datos disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
