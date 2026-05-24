import { apiFetch } from "./api";

export interface FavoriteGenre {
  id: string;
  genreId: string;
}

export interface FavoriteArtist {
  id: string;
  externalId: string;
  name: string;
  imageUrl?: string;
  source: string;
}

export interface FavoriteTrack {
  id: string;
  externalId: string;
  title: string;
  artistName?: string;
  source: string;
}

export interface FavoriteAlbum {
  id: string;
  externalId: string;
  title: string;
  artistName?: string;
  imageUrl?: string;
  source: string;
}

// ── Genres ──

export async function getFavoriteGenres(): Promise<string[]> {
  const favs = await apiFetch<FavoriteGenre[]>("/users/me/favorites/genres");
  return favs.map((f) => f.genreId);
}

export async function addFavoriteGenre(genreId: string): Promise<void> {
  await apiFetch<void>("/users/me/favorites/genres", undefined, {
    method: "POST",
    body: JSON.stringify({ genreId }),
  });
}

export async function removeFavoriteGenre(genreId: string): Promise<void> {
  await apiFetch<void>(
    `/users/me/favorites/genres/${encodeURIComponent(genreId)}`,
    undefined,
    { method: "DELETE" }
  );
}

// ── Artists ──

export async function getFavoriteArtists(): Promise<FavoriteArtist[]> {
  return apiFetch<FavoriteArtist[]>("/users/me/favorites/artists");
}

export async function addFavoriteArtist(artist: {
  externalId: string;
  name: string;
  imageUrl?: string;
  source: string;
}): Promise<void> {
  await apiFetch<void>("/users/me/favorites/artists", undefined, {
    method: "POST",
    body: JSON.stringify(artist),
  });
}

export async function removeFavoriteArtist(id: string): Promise<void> {
  await apiFetch<void>(
    `/users/me/favorites/artists/${encodeURIComponent(id)}`,
    undefined,
    { method: "DELETE" }
  );
}

// ── Tracks ──

export async function getFavoriteTracks(): Promise<FavoriteTrack[]> {
  return apiFetch<FavoriteTrack[]>("/users/me/favorites/tracks");
}

export async function addFavoriteTrack(track: {
  externalId: string;
  title: string;
  artistName?: string;
  source: string;
}): Promise<void> {
  await apiFetch<void>("/users/me/favorites/tracks", undefined, {
    method: "POST",
    body: JSON.stringify(track),
  });
}

export async function removeFavoriteTrack(id: string): Promise<void> {
  await apiFetch<void>(
    `/users/me/favorites/tracks/${encodeURIComponent(id)}`,
    undefined,
    { method: "DELETE" }
  );
}

// ── Albums ──

export async function getFavoriteAlbums(): Promise<FavoriteAlbum[]> {
  return apiFetch<FavoriteAlbum[]>("/users/me/favorites/albums");
}

export async function addFavoriteAlbum(album: {
  externalId: string;
  title: string;
  artistName?: string;
  imageUrl?: string;
  source: string;
}): Promise<void> {
  await apiFetch<void>("/users/me/favorites/albums", undefined, {
    method: "POST",
    body: JSON.stringify(album),
  });
}

export async function removeFavoriteAlbum(id: string): Promise<void> {
  await apiFetch<void>(
    `/users/me/favorites/albums/${encodeURIComponent(id)}`,
    undefined,
    { method: "DELETE" }
  );
}
