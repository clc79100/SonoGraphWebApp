const BASE = "https://www.theaudiodb.com/api/v1/json/123";

const byMBIDCache = new Map<string, string | null>();
const byNameCache = new Map<string, string | null>();

export async function fetchArtistImageByMBID(mbid: string): Promise<string | null> {
  if (byMBIDCache.has(mbid)) return byMBIDCache.get(mbid)!;
  try {
    const res = await fetch(`${BASE}/artist-mb.php?i=${encodeURIComponent(mbid)}`);
    if (!res.ok) { byMBIDCache.set(mbid, null); return null; }
    const data = await res.json();
    const thumb = (data?.artists?.[0]?.strArtistThumb as string) ?? null;
    byMBIDCache.set(mbid, thumb);
    return thumb;
  } catch {
    byMBIDCache.set(mbid, null);
    return null;
  }
}

export async function fetchArtistImageByName(name: string): Promise<string | null> {
  const key = name.toLowerCase().trim();
  if (byNameCache.has(key)) return byNameCache.get(key)!;
  try {
    const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(name.trim())}`);
    if (!res.ok) { byNameCache.set(key, null); return null; }
    const data = await res.json();
    const thumb = (data?.artists?.[0]?.strArtistThumb as string) ?? null;
    byNameCache.set(key, thumb);
    return thumb;
  } catch {
    byNameCache.set(key, null);
    return null;
  }
}
