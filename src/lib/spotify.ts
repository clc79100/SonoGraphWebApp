const ACCOUNTS_BASE = "https://accounts.spotify.com";
const API_BASE = "https://api.spotify.com/v1";

interface TokenCache { token: string; expiresAt: number }
let _tokenCache: TokenCache | null = null;

// ---- Tipos nativos de Spotify ----
export interface SPArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: { url: string; height: number; width: number }[];
  followers?: { total: number };
  externalUrl?: string;
}

export type SPArtistDetails = SPArtist;

export interface SPAlbum {
  id: string;
  name: string;
  release_date: string;
  images: { url: string; height: number; width: number }[];
  album_type: string;
  total_tracks: number;
}

export interface SPTrack {
  id: string;
  name: string;
  duration_ms: number;
  album: { id: string; name: string; images: { url: string }[] };
  preview_url: string | null;
  track_number: number;
}

// ---- Tipo para resultados de búsqueda (compatible MB y Spotify) ----
export interface SearchArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  source: "musicbrainz" | "spotify" | "lastfm";
}

// ---- Tipos unificados para ArtistDetail ----
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

// Error exportable para que la UI pueda distinguir el tipo de fallo
export type SpotifyError = "no_credentials" | "auth_failed" | "premium_required" | "request_failed";
export class SpotifyAPIError extends Error {
  constructor(public readonly code: SpotifyError, message: string) {
    super(message);
    this.name = "SpotifyAPIError";
  }
}

// ---- Caches ----
const artistSearchCache = new Map<string, SPArtist[]>();
const artistCache = new Map<string, SPArtistDetails>();
const albumsCache = new Map<string, SPAlbum[]>();
const tracksCache = new Map<string, SPTrack[]>();

// ---- Auth ----
async function getAccessToken(): Promise<string | null> {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("Spotify: credenciales no configuradas (VITE_SPOTIFY_CLIENT_ID / VITE_SPOTIFY_CLIENT_SECRET)");
    return null;
  }
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.token;
  try {
    const creds = btoa(`${clientId}:${clientSecret}`);
    const res = await fetch(`${ACCOUNTS_BASE}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Spotify auth ${res.status}`);
    const data = await res.json();
    _tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return _tokenCache.token;
  } catch (err) {
    console.error("Spotify token error", err);
    return null;
  }
}

async function spotifyFetch<T>(path: string): Promise<T | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    // Spotify devuelve este mensaje cuando el dueño de la app no tiene Premium
    if (body.includes("premium") || body.includes("Premium")) {
      throw new SpotifyAPIError(
        "premium_required",
        "La cuenta del desarrollador requiere Spotify Premium para usar la API."
      );
    }
    throw new SpotifyAPIError("request_failed", `Spotify ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

// ---- Funciones públicas ----

export async function searchArtistByName(name: string, limit = 10): Promise<SPArtist[]> {
  const key = `${name.toLowerCase().trim()}:${limit}`;
  if (artistSearchCache.has(key)) return artistSearchCache.get(key)!;
  // Deja que SpotifyAPIError se propague para que la UI pueda mostrar el motivo
  const data = await spotifyFetch<any>(
    `/search?q=${encodeURIComponent(name.trim())}&type=artist&limit=${limit}`
  );
  const artists: SPArtist[] = (data?.artists?.items || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    genres: a.genres || [],
    popularity: a.popularity,
    images: a.images || [],
    followers: a.followers,
    externalUrl: a.external_urls?.spotify,
  }));
  artistSearchCache.set(key, artists);
  return artists;
}

export async function getArtistById(id: string): Promise<SPArtistDetails | null> {
  if (artistCache.has(id)) return artistCache.get(id)!;
  const a = await spotifyFetch<any>(`/artists/${id}`);
  if (!a) return null;
  const details: SPArtistDetails = {
    id: a.id,
    name: a.name,
    genres: a.genres || [],
    popularity: a.popularity,
    images: a.images || [],
    followers: a.followers,
    externalUrl: a.external_urls?.spotify,
  };
  artistCache.set(id, details);
  return details;
}

export async function getArtistAlbums(id: string, limit = 18): Promise<SPAlbum[]> {
  const key = `${id}:${limit}`;
  if (albumsCache.has(key)) return albumsCache.get(key)!;
  const data = await spotifyFetch<any>(
    `/artists/${id}/albums?include_groups=album&limit=${limit}&market=US`
  );
  const albums: SPAlbum[] = (data?.items || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    release_date: a.release_date || "",
    images: a.images || [],
    album_type: a.album_type,
    total_tracks: a.total_tracks,
  }));
  albumsCache.set(key, albums);
  return albums;
}

export async function getArtistTopTracks(id: string): Promise<SPTrack[]> {
  if (tracksCache.has(id)) return tracksCache.get(id)!;
  const data = await spotifyFetch<any>(`/artists/${id}/top-tracks?market=US`);
  const tracks: SPTrack[] = (data?.tracks || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    duration_ms: t.duration_ms,
    album: { id: t.album?.id, name: t.album?.name, images: t.album?.images || [] },
    preview_url: t.preview_url,
    track_number: t.track_number,
  }));
  tracksCache.set(id, tracks);
  return tracks;
}

export async function fetchArtistImage(id: string): Promise<string | null> {
  const details = await getArtistById(id);
  return details?.images?.[0]?.url ?? null;
}

// ---- Genre / Tag search ----

const genreArtistsCache = new Map<string, SPArtist[]>();
const genreTracksCache = new Map<string, { id: string; name: string; artistName?: string; duration_ms: number }[]>();

export async function searchArtistsByGenre(genre: string, limit = 10): Promise<SPArtist[]> {
  const key = `${genre.toLowerCase()}:${limit}`;
  if (genreArtistsCache.has(key)) return genreArtistsCache.get(key)!;
  const data = await spotifyFetch<any>(
    `/search?q=genre:"${encodeURIComponent(genre)}"&type=artist&limit=${limit}`
  );
  const artists: SPArtist[] = (data?.artists?.items || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    genres: a.genres || [],
    popularity: a.popularity,
    images: a.images || [],
    followers: a.followers,
    externalUrl: a.external_urls?.spotify,
  }));
  genreArtistsCache.set(key, artists);
  return artists;
}

export async function searchTracksByGenre(genre: string, limit = 12) {
  const key = `${genre.toLowerCase()}:${limit}`;
  if (genreTracksCache.has(key)) return genreTracksCache.get(key)!;
  const data = await spotifyFetch<any>(
    `/search?q=genre:"${encodeURIComponent(genre)}"&type=track&limit=${limit}`
  );
  const tracks = (data?.tracks?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artistName: t.artists?.[0]?.name as string | undefined,
    duration_ms: t.duration_ms as number,
  }));
  genreTracksCache.set(key, tracks);
  return tracks;
}

// ---- Mapping SP → Unified ----

export function spToUnifiedArtist(d: SPArtistDetails): UnifiedArtist {
  return {
    id: d.id,
    name: d.name,
    genres: d.genres,
    image: d.images?.[0]?.url ?? null,
  };
}

export function spToUnifiedAlbums(albums: SPAlbum[]): UnifiedAlbum[] {
  return albums.map((a) => ({
    id: a.id,
    title: a.name,
    imageUrl: a.images?.[0]?.url,
    year: a.release_date?.slice(0, 4),
    externalUrl: `https://open.spotify.com/album/${a.id}`,
  }));
}

export function spToUnifiedTracks(tracks: SPTrack[]): UnifiedTrack[] {
  return tracks.map((t) => ({
    id: t.id,
    title: t.name,
    duration: t.duration_ms,
    album: t.album?.name,
    albumImageUrl: t.album?.images?.[0]?.url,
    externalUrl: `https://open.spotify.com/track/${t.id}`,
  }));
}
