// MusicBrainz: API pública gratuita. Rate limit ~1 req/s.

const BASE = "https://musicbrainz.org/ws/2";

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
  genres: string[]; // tag/genre names lowercased
}

const artistCache = new Map<string, MBArtist[]>();
const recordingCache = new Map<string, MBRecording[]>();
const imageCache = new Map<string, string | null>();
const artistDetailsCache = new Map<string, MBArtistDetails>();
const artistRecordingsCache = new Map<string, MBRecording[]>();
const artistAlbumsCache = new Map<string, MBReleaseGroup[]>();
const artistSearchCache = new Map<string, MBArtist[]>();

export async function searchArtistsByTag(tag: string, limit = 8): Promise<MBArtist[]> {
  const key = `${tag}:${limit}`;
  if (artistCache.has(key)) return artistCache.get(key)!;
  const q = `tag:"${tag.toLowerCase()}"`;
  const url = `${BASE}/artist?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const artists: MBArtist[] = (data.artists || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      country: a.country,
      disambiguation: a.disambiguation,
      score: a.score,
    }));
    artistCache.set(key, artists);
    return artists;
  } catch (err) {
    console.error("MusicBrainz artist error", err);
    return [];
  }
}

export async function searchArtistsByName(name: string, limit = 10): Promise<MBArtist[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const key = `${trimmed.toLowerCase()}:${limit}`;
  if (artistSearchCache.has(key)) return artistSearchCache.get(key)!;
  const url = `${BASE}/artist?query=${encodeURIComponent(trimmed)}&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const artists: MBArtist[] = (data.artists || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      country: a.country,
      disambiguation: a.disambiguation,
      score: a.score,
    }));
    artistSearchCache.set(key, artists);
    return artists;
  } catch (err) {
    console.error("MusicBrainz artist search error", err);
    return [];
  }
}

export async function getArtistDetails(id: string): Promise<MBArtistDetails | null> {
  if (artistDetailsCache.has(id)) return artistDetailsCache.get(id)!;
  const url = `${BASE}/artist/${id}?inc=genres+tags&fmt=json`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const a = await res.json();
    const genres = new Set<string>();
    (a.genres || []).forEach((g: any) => g?.name && genres.add(String(g.name).toLowerCase()));
    (a.tags || []).forEach((t: any) => t?.name && genres.add(String(t.name).toLowerCase()));
    const details: MBArtistDetails = {
      id: a.id,
      name: a.name,
      country: a.country,
      disambiguation: a.disambiguation,
      type: a.type,
      area: a.area?.name,
      beginDate: a["life-span"]?.begin,
      endDate: a["life-span"]?.end,
      genres: Array.from(genres),
    };
    artistDetailsCache.set(id, details);
    return details;
  } catch (err) {
    console.error("MusicBrainz artist details error", err);
    return null;
  }
}

export async function getArtistTopRecordings(id: string, limit = 12): Promise<MBRecording[]> {
  const key = `${id}:${limit}`;
  if (artistRecordingsCache.has(key)) return artistRecordingsCache.get(key)!;
  const url = `${BASE}/recording?artist=${id}&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const recs: MBRecording[] = (data.recordings || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      artist: r["artist-credit"]?.[0]?.name,
      artistId: r["artist-credit"]?.[0]?.artist?.id,
      length: r.length,
    }));
    artistRecordingsCache.set(key, recs);
    return recs;
  } catch (err) {
    console.error("MusicBrainz artist recordings error", err);
    return [];
  }
}

export async function getArtistAlbums(id: string, limit = 16): Promise<MBReleaseGroup[]> {
  const key = `${id}:${limit}`;
  if (artistAlbumsCache.has(key)) return artistAlbumsCache.get(key)!;
  const url = `${BASE}/release-group?artist=${id}&type=album&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const list: MBReleaseGroup[] = (data["release-groups"] || []).map((rg: any) => ({
      id: rg.id,
      title: rg.title,
      firstReleaseDate: rg["first-release-date"],
      primaryType: rg["primary-type"],
    }));
    list.sort((a, b) => (a.firstReleaseDate || "").localeCompare(b.firstReleaseDate || ""));
    artistAlbumsCache.set(key, list);
    return list;
  } catch (err) {
    console.error("MusicBrainz albums error", err);
    return [];
  }
}

export function coverArtUrl(releaseGroupId: string, size: 250 | 500 = 250): string {
  return `https://coverartarchive.org/release-group/${releaseGroupId}/front-${size}`;
}

export async function searchRecordingsByTag(tag: string, limit = 10): Promise<MBRecording[]> {
  const key = `${tag}:${limit}`;
  if (recordingCache.has(key)) return recordingCache.get(key)!;
  const q = `tag:"${tag.toLowerCase()}"`;
  const url = `${BASE}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const recordings: MBRecording[] = (data.recordings || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      artist: r["artist-credit"]?.[0]?.name,
      artistId: r["artist-credit"]?.[0]?.artist?.id,
      length: r.length,
    }));
    recordingCache.set(key, recordings);
    return recordings;
  } catch (err) {
    console.error("MusicBrainz recording error", err);
    return [];
  }
}

// Wikipedia REST: imagen de artista por nombre.
export async function fetchArtistImage(name: string): Promise<string | null> {
  if (imageCache.has(name)) return imageCache.get(name)!;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      imageCache.set(name, null);
      return null;
    }
    const data = await res.json();
    const img: string | null = data.thumbnail?.source ?? data.originalimage?.source ?? null;
    imageCache.set(name, img);
    return img;
  } catch {
    imageCache.set(name, null);
    return null;
  }
}
