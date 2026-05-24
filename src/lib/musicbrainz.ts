import { apiFetch } from "./api";
import type { SearchArtist, UnifiedArtist, UnifiedAlbum, UnifiedTrack } from "./spotify";

export interface SimpleTrack {
  id: string;
  title: string;
  artistName?: string;
  duration?: number; // ms
}

// Tipos legacy mantenidos para compatibilidad con componentes existentes
export interface MBArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  score?: number;
}

export interface MBRecording {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  length?: number;
}

export interface MBReleaseGroup {
  id: string;
  title: string;
  firstReleaseDate?: string;
  primaryType?: string;
}

export interface MBArtistDetails {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  type?: string;
  area?: string;
  beginDate?: string;
  endDate?: string;
  genres: string[];
}

export async function searchArtistsByTag(genreId: string, limit = 8): Promise<SearchArtist[]> {
  try {
    return await apiFetch<SearchArtist[]>(`/api/genres/${encodeURIComponent(genreId)}/artists`, {
      source: "musicbrainz",
      limit,
    });
  } catch (err) {
    console.error("MB searchArtistsByTag error", err);
    return [];
  }
}

export async function searchArtistsByName(name: string, limit = 10): Promise<SearchArtist[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  try {
    return await apiFetch<SearchArtist[]>("/api/search/artists", {
      source: "musicbrainz",
      q: trimmed,
      limit,
    });
  } catch (err) {
    console.error("MB searchArtistsByName error", err);
    return [];
  }
}

export async function getArtistDetails(id: string): Promise<UnifiedArtist | null> {
  try {
    return await apiFetch<UnifiedArtist>(`/api/artists/${encodeURIComponent(id)}`, {
      source: "musicbrainz",
    });
  } catch (err) {
    console.error("MB getArtistDetails error", err);
    return null;
  }
}

export async function getArtistTopRecordings(id: string, limit = 12): Promise<UnifiedTrack[]> {
  try {
    return await apiFetch<UnifiedTrack[]>(`/api/artists/${encodeURIComponent(id)}/tracks`, {
      source: "musicbrainz",
      limit,
    });
  } catch (err) {
    console.error("MB getArtistTopRecordings error", err);
    return [];
  }
}

export async function getArtistAlbums(id: string, limit = 16): Promise<UnifiedAlbum[]> {
  try {
    return await apiFetch<UnifiedAlbum[]>(`/api/artists/${encodeURIComponent(id)}/albums`, {
      source: "musicbrainz",
      limit,
    });
  } catch (err) {
    console.error("MB getArtistAlbums error", err);
    return [];
  }
}

export async function searchRecordingsByTag(genreId: string, limit = 10): Promise<SimpleTrack[]> {
  try {
    return await apiFetch<SimpleTrack[]>(`/api/genres/${encodeURIComponent(genreId)}/tracks`, {
      source: "musicbrainz",
      limit,
    });
  } catch (err) {
    console.error("MB searchRecordingsByTag error", err);
    return [];
  }
}

export async function fetchArtistImage(id: string): Promise<string | null> {
  try {
    const data = await apiFetch<{ image: string | null }>(
      `/api/artists/${encodeURIComponent(id)}/image`,
      { source: "musicbrainz" }
    );
    return data.image;
  } catch {
    return null;
  }
}
