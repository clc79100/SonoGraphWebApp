import { apiFetch } from "./api";

// ---- Tipos unificados (contrato entre fuentes y UI) ----

export interface SearchArtist {
  id: string;
  name: string;
  image?: string | null;
  country?: string;
  disambiguation?: string;
  source: "musicbrainz" | "spotify" | "lastfm";
}

export interface UnifiedArtist {
  id: string;
  name: string;
  genres: string[];
  image?: string | null;
  country?: string;
  disambiguation?: string;
  type?: string;
  area?: string;
  beginDate?: string;
  endDate?: string;
  externalUrl?: string;
}

export interface UnifiedAlbum {
  id: string;
  title: string;
  imageUrl?: string;
  year?: string;
  externalUrl?: string;
}

export interface UnifiedTrack {
  id: string;
  title: string;
  duration?: number; // ms
  album?: string;
  albumImageUrl?: string;
  externalUrl?: string;
}

export interface SimpleTrack {
  id: string;
  title: string;
  artistName?: string;
  duration?: number; // ms
}

export type SpotifyError = "no_credentials" | "auth_failed" | "premium_required" | "request_failed";
export class SpotifyAPIError extends Error {
  constructor(public readonly code: SpotifyError, message: string) {
    super(message);
    this.name = "SpotifyAPIError";
  }
}

// ---- Funciones públicas ----

export async function searchArtistByName(name: string, limit = 10): Promise<SearchArtist[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  try {
    return await apiFetch<SearchArtist[]>("/api/search/artists", {
      source: "spotify",
      q: trimmed,
      limit,
    });
  } catch (err: any) {
    if (err?.code === "premium_required") {
      throw new SpotifyAPIError("premium_required", err.message);
    }
    console.error("Spotify searchArtistByName error", err);
    return [];
  }
}

export async function getArtistById(id: string): Promise<UnifiedArtist | null> {
  try {
    return await apiFetch<UnifiedArtist>(`/api/artists/${encodeURIComponent(id)}`, {
      source: "spotify",
    });
  } catch (err: any) {
    if (err?.code === "premium_required") {
      throw new SpotifyAPIError("premium_required", err.message);
    }
    console.error("Spotify getArtistById error", err);
    return null;
  }
}

export async function getArtistAlbums(id: string, limit = 18): Promise<UnifiedAlbum[]> {
  try {
    return await apiFetch<UnifiedAlbum[]>(`/api/artists/${encodeURIComponent(id)}/albums`, {
      source: "spotify",
      limit,
    });
  } catch (err) {
    console.error("Spotify getArtistAlbums error", err);
    return [];
  }
}

export async function getArtistTopTracks(id: string): Promise<UnifiedTrack[]> {
  try {
    return await apiFetch<UnifiedTrack[]>(`/api/artists/${encodeURIComponent(id)}/tracks`, {
      source: "spotify",
    });
  } catch (err) {
    console.error("Spotify getArtistTopTracks error", err);
    return [];
  }
}

export async function searchArtistsByGenre(genreId: string, limit = 10): Promise<SearchArtist[]> {
  try {
    return await apiFetch<SearchArtist[]>(`/api/genres/${encodeURIComponent(genreId)}/artists`, {
      source: "spotify",
      limit,
    });
  } catch (err: any) {
    if (err?.code === "premium_required") {
      throw new SpotifyAPIError("premium_required", err.message);
    }
    console.error("Spotify searchArtistsByGenre error", err);
    return [];
  }
}

export async function searchTracksByGenre(genreId: string, limit = 12): Promise<SimpleTrack[]> {
  try {
    return await apiFetch<SimpleTrack[]>(`/api/genres/${encodeURIComponent(genreId)}/tracks`, {
      source: "spotify",
      limit,
    });
  } catch (err) {
    console.error("Spotify searchTracksByGenre error", err);
    return [];
  }
}
