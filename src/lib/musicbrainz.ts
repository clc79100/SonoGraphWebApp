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

const artistCache = new Map<string, MBArtist[]>();
const recordingCache = new Map<string, MBRecording[]>();
const imageCache = new Map<string, string | null>();

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
