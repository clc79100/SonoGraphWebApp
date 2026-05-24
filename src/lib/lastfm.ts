import { apiFetch } from "./api";
import type { SearchArtist, UnifiedArtist, UnifiedAlbum, UnifiedTrack, SimpleTrack } from "./spotify";

export type LastfmError = "no_credentials" | "request_failed" | "not_found";
export class LastfmAPIError extends Error {
  constructor(public readonly code: LastfmError, message: string) {
    super(message);
    this.name = "LastfmAPIError";
  }
}

// Tipos legacy expuestos para compatibilidad con componentes existentes
export interface LFMTagArtist {
  name: string;
  mbid?: string;
  url: string;
}

export interface LFMTagTrack {
  name: string;
  mbid?: string;
  url: string;
  duration?: string;
  artist?: { name: string; mbid?: string; url: string };
}

// ---- Funciones públicas ----

export async function searchArtistByName(name: string, limit = 10): Promise<SearchArtist[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  try {
    return await apiFetch<SearchArtist[]>("/api/search/artists", {
      source: "lastfm",
      q: trimmed,
      limit,
    });
  } catch (err) {
    console.error("Last.fm searchArtistByName error", err);
    return [];
  }
}

export async function getArtistById(id: string): Promise<UnifiedArtist | null> {
  try {
    return await apiFetch<UnifiedArtist>(`/api/artists/${encodeURIComponent(id)}`, {
      source: "lastfm",
    });
  } catch (err: any) {
    if (err?.status === 404) return null;
    console.error("Last.fm getArtistById error", err);
    return null;
  }
}

export async function getArtistAlbums(id: string, limit = 18): Promise<UnifiedAlbum[]> {
  try {
    return await apiFetch<UnifiedAlbum[]>(`/api/artists/${encodeURIComponent(id)}/albums`, {
      source: "lastfm",
      limit,
    });
  } catch (err) {
    console.error("Last.fm getArtistAlbums error", err);
    return [];
  }
}

export async function getArtistTopTracks(id: string, limit = 12): Promise<UnifiedTrack[]> {
  try {
    return await apiFetch<UnifiedTrack[]>(`/api/artists/${encodeURIComponent(id)}/tracks`, {
      source: "lastfm",
      limit,
    });
  } catch (err) {
    console.error("Last.fm getArtistTopTracks error", err);
    return [];
  }
}

export async function fetchArtistImage(id: string): Promise<string | null> {
  try {
    const data = await apiFetch<{ image: string | null }>(
      `/api/artists/${encodeURIComponent(id)}/image`,
      { source: "lastfm" }
    );
    return data.image;
  } catch {
    return null;
  }
}

export async function searchArtistsByTag(genreId: string, limit = 10): Promise<SearchArtist[]> {
  try {
    return await apiFetch<SearchArtist[]>(`/api/genres/${encodeURIComponent(genreId)}/artists`, {
      source: "lastfm",
      limit,
    });
  } catch (err) {
    console.error("Last.fm searchArtistsByTag error", err);
    return [];
  }
}

export async function searchTracksByTag(genreId: string, limit = 12): Promise<SimpleTrack[]> {
  try {
    return await apiFetch<SimpleTrack[]>(`/api/genres/${encodeURIComponent(genreId)}/tracks`, {
      source: "lastfm",
      limit,
    });
  } catch (err) {
    console.error("Last.fm searchTracksByTag error", err);
    return [];
  }
}
