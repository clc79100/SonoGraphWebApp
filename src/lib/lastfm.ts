import type { UnifiedArtist, UnifiedAlbum, UnifiedTrack } from "./spotify";

const API_BASE = "https://ws.audioscrobbler.com/2.0/";

// Placeholder/deprecated image hash that Last.fm returns when no real cover exists
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

// ---- Tipos nativos ----
export interface LFMImage {
  "#text": string;
  size: "small" | "medium" | "large" | "extralarge" | "mega" | "";
}

export interface LFMArtist {
  name: string;
  mbid?: string;
  url: string;
  image?: LFMImage[];
  listeners?: string;
  playcount?: string;
  tags?: { tag: { name: string; url?: string }[] };
  bio?: { summary: string; content: string };
}

export interface LFMAlbum {
  name: string;
  mbid?: string;
  playcount: number;
  url: string;
  image?: LFMImage[];
  artist: { name: string; mbid?: string; url: string };
}

export interface LFMTrack {
  name: string;
  mbid?: string;
  playcount: string;
  listeners: string;
  url: string;
  duration?: string; // seconds
  image?: LFMImage[];
  artist?: { name: string; mbid?: string; url: string };
}

export type LastfmError = "no_credentials" | "request_failed" | "not_found";
export class LastfmAPIError extends Error {
  constructor(public readonly code: LastfmError, message: string) {
    super(message);
    this.name = "LastfmAPIError";
  }
}

// ---- Caches ----
const artistSearchCache = new Map<string, LFMArtist[]>();
const artistCache = new Map<string, LFMArtist>();
const albumsCache = new Map<string, LFMAlbum[]>();
const tracksCache = new Map<string, LFMTrack[]>();

// ---- Helpers ----
function getApiKey(): string | null {
  const key = import.meta.env.VITE_LASTFM_API_KEY;
  if (!key) {
    console.warn("Last.fm: credencial no configurada (VITE_LASTFM_API_KEY)");
    return null;
  }
  return key;
}

async function lfmFetch<T>(params: Record<string, string>): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new LastfmAPIError("no_credentials", "Falta VITE_LASTFM_API_KEY en .env");
  }
  const qs = new URLSearchParams({ ...params, api_key: apiKey, format: "json" });
  const res = await fetch(`${API_BASE}?${qs.toString()}`);
  if (!res.ok) {
    throw new LastfmAPIError("request_failed", `Last.fm ${res.status} ${params.method}`);
  }
  const data = await res.json();
  if (data?.error) {
    if (data.error === 6) {
      throw new LastfmAPIError("not_found", data.message || "No encontrado");
    }
    throw new LastfmAPIError("request_failed", data.message || "Error desconocido");
  }
  return data as T;
}

/** Resuelve un id local a parámetro `mbid` o `artist` */
function idToParam(id: string): { mbid?: string; artist?: string } {
  if (id.startsWith("name:")) return { artist: id.slice(5) };
  return { mbid: id };
}

function pickImage(images?: LFMImage[]): string | null {
  if (!images || !images.length) return null;
  const order = ["mega", "extralarge", "large", "medium", "small"];
  for (const size of order) {
    const found = images.find((i) => i.size === size && i["#text"]);
    if (found && !found["#text"].includes(LASTFM_PLACEHOLDER)) {
      return found["#text"];
    }
  }
  return null;
}

// ---- Funciones públicas ----

export async function searchArtistByName(name: string, limit = 10): Promise<LFMArtist[]> {
  const key = `${name.toLowerCase().trim()}:${limit}`;
  if (artistSearchCache.has(key)) return artistSearchCache.get(key)!;
  const data = await lfmFetch<any>({
    method: "artist.search",
    artist: name.trim(),
    limit: String(limit),
  });
  const matches = data?.results?.artistmatches?.artist || [];
  const artists: LFMArtist[] = matches.map((a: any) => ({
    name: a.name,
    mbid: a.mbid,
    url: a.url,
    image: a.image,
    listeners: a.listeners,
  }));
  artistSearchCache.set(key, artists);
  return artists;
}

export async function getArtistById(id: string): Promise<LFMArtist | null> {
  if (artistCache.has(id)) return artistCache.get(id)!;
  try {
    const data = await lfmFetch<any>({
      method: "artist.getinfo",
      ...idToParam(id),
      autocorrect: "1",
    });
    const a = data?.artist;
    if (!a) return null;
    const artist: LFMArtist = {
      name: a.name,
      mbid: a.mbid,
      url: a.url,
      image: a.image,
      listeners: a.stats?.listeners,
      playcount: a.stats?.playcount,
      tags: a.tags,
      bio: a.bio,
    };
    artistCache.set(id, artist);
    return artist;
  } catch (err) {
    if (err instanceof LastfmAPIError && err.code === "not_found") return null;
    throw err;
  }
}

export async function getArtistAlbums(id: string, limit = 18): Promise<LFMAlbum[]> {
  const cacheKey = `${id}:${limit}`;
  if (albumsCache.has(cacheKey)) return albumsCache.get(cacheKey)!;
  const data = await lfmFetch<any>({
    method: "artist.gettopalbums",
    ...idToParam(id),
    autocorrect: "1",
    limit: String(limit),
  });
  const items = data?.topalbums?.album || [];
  const albums: LFMAlbum[] = items.map((a: any) => ({
    name: a.name,
    mbid: a.mbid,
    playcount: Number(a.playcount) || 0,
    url: a.url,
    image: a.image,
    artist: a.artist,
  }));
  albumsCache.set(cacheKey, albums);
  return albums;
}

export async function getArtistTopTracks(id: string, limit = 12): Promise<LFMTrack[]> {
  const cacheKey = `${id}:${limit}`;
  if (tracksCache.has(cacheKey)) return tracksCache.get(cacheKey)!;
  const data = await lfmFetch<any>({
    method: "artist.gettoptracks",
    ...idToParam(id),
    autocorrect: "1",
    limit: String(limit),
  });
  const items = data?.toptracks?.track || [];
  const tracks: LFMTrack[] = items.map((t: any) => ({
    name: t.name,
    mbid: t.mbid,
    playcount: t.playcount,
    listeners: t.listeners,
    url: t.url,
    duration: t.duration,
    image: t.image,
    artist: t.artist,
  }));
  tracksCache.set(cacheKey, tracks);
  return tracks;
}

export async function fetchArtistImage(id: string): Promise<string | null> {
  const a = await getArtistById(id);
  return pickImage(a?.image);
}

// ---- Tag / Genre search ----

export interface LFMTagArtist {
  name: string;
  mbid?: string;
  url: string;
}

export interface LFMTagTrack {
  name: string;
  mbid?: string;
  url: string;
  duration?: string; // seconds
  artist?: { name: string; mbid?: string; url: string };
}

const tagArtistsCache = new Map<string, LFMTagArtist[]>();
const tagTracksCache = new Map<string, LFMTagTrack[]>();

export async function searchArtistsByTag(tag: string, limit = 10): Promise<LFMTagArtist[]> {
  const key = `${tag.toLowerCase()}:${limit}`;
  if (tagArtistsCache.has(key)) return tagArtistsCache.get(key)!;
  const data = await lfmFetch<any>({ method: "tag.gettopartists", tag, limit: String(limit) });
  const items = data?.topartists?.artist || [];
  const artists: LFMTagArtist[] = items.map((a: any) => ({
    name: a.name,
    mbid: a.mbid || undefined,
    url: a.url,
  }));
  tagArtistsCache.set(key, artists);
  return artists;
}

export async function searchTracksByTag(tag: string, limit = 12): Promise<LFMTagTrack[]> {
  const key = `${tag.toLowerCase()}:${limit}`;
  if (tagTracksCache.has(key)) return tagTracksCache.get(key)!;
  const data = await lfmFetch<any>({ method: "tag.gettoptracks", tag, limit: String(limit) });
  const items = data?.tracks?.track || [];
  const tracks: LFMTagTrack[] = items.map((t: any) => ({
    name: t.name,
    mbid: t.mbid || undefined,
    url: t.url,
    duration: t.duration,
    artist: t.artist,
  }));
  tagTracksCache.set(key, tracks);
  return tracks;
}

// ---- Mapping LFM → Unified ----

export function lfmToUnifiedArtist(a: LFMArtist): UnifiedArtist {
  return {
    id: a.mbid || `name:${a.name}`,
    name: a.name,
    genres: a.tags?.tag?.map((t) => t.name) ?? [],
    image: pickImage(a.image),
    externalUrl: a.url,
  };
}

export function lfmToUnifiedAlbums(albums: LFMAlbum[]): UnifiedAlbum[] {
  return albums.map((a) => ({
    id: a.mbid || `name:${a.artist?.name}|${a.name}`,
    title: a.name,
    imageUrl: pickImage(a.image) ?? undefined,
    year: undefined,
    externalUrl: a.url,
  }));
}

export function lfmToUnifiedTracks(tracks: LFMTrack[]): UnifiedTrack[] {
  return tracks.map((t) => ({
    id: t.mbid || `name:${t.artist?.name}|${t.name}`,
    title: t.name,
    duration: t.duration ? Number(t.duration) * 1000 : undefined,
    albumImageUrl: pickImage(t.image) ?? undefined,
    externalUrl: t.url,
  }));
}
