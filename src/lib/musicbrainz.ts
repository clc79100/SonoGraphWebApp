// MusicBrainz: API pública gratuita. Rate limit ~1 req/s.
// Buscamos artistas por tag (los géneros suelen coincidir con tags).

const BASE = "https://musicbrainz.org/ws/2";

export interface MBArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  score?: number;
}

const cache = new Map<string, MBArtist[]>();

export async function searchArtistsByTag(tag: string, limit = 8): Promise<MBArtist[]> {
  const key = `${tag}:${limit}`;
  if (cache.has(key)) return cache.get(key)!;
  // MusicBrainz tag is lower-case with spaces
  const q = `tag:"${tag.toLowerCase()}"`;
  const url = `${BASE}/artist?query=${encodeURIComponent(q)}&fmt=json&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`MB ${res.status}`);
    const data = await res.json();
    const artists: MBArtist[] = (data.artists || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      country: a.country,
      disambiguation: a.disambiguation,
      score: a.score,
    }));
    cache.set(key, artists);
    return artists;
  } catch (err) {
    console.error("MusicBrainz error", err);
    return [];
  }
}
