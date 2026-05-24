# Backend de Sonograph — referencia para el frontend

Este documento describe la **API propia** (NestJS, repo `SonoGraphAPI`) que reemplaza las llamadas directas del frontend a MusicBrainz, Spotify, Last.fm y TheAudioDB. El objetivo: que `src/lib/*` deje de pegarle a las APIs externas y en su lugar haga `fetch` a este backend.

> El backend ya oculta las API keys, cachea en Redis y **normaliza todo a los tipos `Unified*`**. Esos tipos (`UnifiedArtist`, `UnifiedAlbum`, `UnifiedTrack`, `SearchArtist`) **no cambian**, así que los componentes de UI no necesitan tocarse — solo la capa `src/lib/`.

## Configuración

- Base URL en una sola env: **`VITE_API_URL`** (ej. `http://localhost:3000` en dev, la URL de AWS en prod).
- CORS ya permite el origen del front (`CORS_ORIGIN` en el backend).
- Las keys de Spotify/Last.fm **ya no van en el frontend** (se eliminan las `VITE_SPOTIFY_*` y `VITE_LASTFM_*` del bundle).

## El parámetro `source`

Casi todos los endpoints del proxy reciben `?source=` con uno de: `musicbrainz` | `spotify` | `lastfm`. Es el equivalente al selector de Fuente actual (`DataSourceContext`).

> ⚠️ **Spotify** responde `502 { code: "premium_required" }` si la cuenta del desarrollador no tiene Premium. El front debe manejar ese caso (mensaje al usuario o fallback a MusicBrainz/Last.fm). Por ahora usar MusicBrainz o Last.fm como fuente por defecto.

## Códigos de error del proxy

| Status | code | Significado |
|---|---|---|
| 400 | — | `source` inválido o parámetro mal formado |
| 404 | — | artista/género no encontrado |
| 502 | `premium_required` | Spotify sin Premium |
| 502 | `request_failed` | falló la API externa |
| 503 | `no_credentials` | falta la API key en el backend |

---

## Endpoints

### Géneros y familias (reemplazan a `src/data/genres.ts`)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/genres` | `GenreResponse[]` — todos los géneros para construir el grafo |
| GET | `/genres/:id` | `GenreResponse` |
| GET | `/families` | `{ id, name }[]` |

```ts
interface GenreResponse {
  id: string;           // "alternative-rock"
  name: string;         // "Alternative Rock"
  family: string;       // family id, ej "rock"
  parents: string[];    // ids de géneros padre (aristas jerárquicas)
  related: string[];    // ids relacionados (aristas de afinidad)
  era?: string;
  region?: string;
  description?: string;
  sourceTags?: { musicbrainz?: string; spotify?: string; lastfm?: string };
}
```

> El **color** de cada familia sigue siendo responsabilidad del frontend (CSS vars); la API solo da `id` + `name`. Mapea `family` → color como hoy.

### Proxy de artistas (`/api`)

| Método | Ruta | Query | Devuelve |
|---|---|---|---|
| GET | `/api/search/artists` | `q`, `source`, `limit=10` | `SearchArtist[]` |
| GET | `/api/artists/:id` | `source` | `UnifiedArtist` (incluye `image` ya resuelta) |
| GET | `/api/artists/:id/albums` | `source`, `limit=18` | `UnifiedAlbum[]` |
| GET | `/api/artists/:id/tracks` | `source`, `limit=12` | `UnifiedTrack[]` |
| GET | `/api/artists/:id/image` | `source` | `{ image: string \| null }` |
| GET | `/api/genres/:genreId/artists` | `source`, `limit=10` | `SearchArtist[]` |
| GET | `/api/genres/:genreId/tracks` | `source`, `limit=12` | `SimpleTrack[]` |

```ts
interface SimpleTrack { id: string; title: string; artistName?: string; duration?: number /* ms */ }
```

**Notas clave para la migración:**
- El `:id` de `/api/artists/:id/*` es el id que devuelve `search` **de esa misma fuente** (MBID en MusicBrainz, id de Spotify, o `mbid`/`name:<artista>` en Last.fm). Es la misma lógica de ids que ya maneja el front por fuente.
- Para el **sidebar de género** ya **no** se pasa un "tag": se pasa el **`genreId`** del nodo del grafo. El backend traduce género→tag internamente (tabla `genre_source_tags`).
- La **imagen** ya viene resuelta en `/api/artists/:id` (estrategia AudioDB→fuente→null hecha en el server). El endpoint `/image` separado existe por si la quieres cargar aparte.
- `album.imageUrl` ya viene lista (CoverArtArchive para MB, imagen de la fuente para el resto) — ya no se construye URL en el cliente.

### Auth (JWT) — funcionalidad nueva

| Método | Ruta | Body | Devuelve |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | — (Bearer access) | 204 |

- Mandar el access en cada request protegido: header `Authorization: Bearer <accessToken>`.
- Access dura 15 min; cuando expira (401), pedir nuevos con `/auth/refresh` usando el refresh (dura 7 días). El refresh rota: el viejo deja de servir.
- `logout` revoca el access actual (blacklist) y borra el refresh.

### Favoritos — funcionalidad nueva (requieren Bearer)

| Método | Ruta | Body |
|---|---|---|
| GET/POST/DELETE | `/users/me/favorites/genres[/:genreId]` | — (genreId en la ruta) |
| GET | `/users/me/favorites/artists` | — |
| POST | `/users/me/favorites/artists` | `{ externalId, name, imageUrl?, source }` |
| DELETE | `/users/me/favorites/artists/:id` | — |
| GET/POST/DELETE | `/users/me/favorites/tracks` | POST: `{ externalId, title, artistName?, source }` |
| GET/POST/DELETE | `/users/me/favorites/albums` | POST: `{ externalId, title, artistName?, imageUrl?, source }` |

(`POST` es idempotente; `DELETE /:id` usa el `id` UUID que devolvió el `POST`/`GET`.)

### Historial de visitas — funcionalidad nueva (requieren Bearer)

| Método | Ruta | Query | Devuelve |
|---|---|---|---|
| POST | `/users/me/genre-visits/:genreId` | — | registra una visita |
| GET | `/users/me/genre-visits/recent` | `limit=10` | `{ genreId, lastVisit }[]` |
| GET | `/users/me/genre-visits/top` | `limit=10` | `{ genreId, visits }[]` |

---

## Mapeo: call hardcodeada actual → endpoint de la API

Reemplazar el cuerpo de cada función de `src/lib/` por un `fetch(`${import.meta.env.VITE_API_URL}...`)`. Las firmas y los tipos de retorno (`Unified*`) se mantienen.

### `src/lib/musicbrainz.ts`
| Función actual | Nuevo endpoint |
|---|---|
| `searchArtistsByName(name, limit)` | `GET /api/search/artists?source=musicbrainz&q={name}&limit={limit}` |
| `getArtistDetails(mbid)` | `GET /api/artists/{mbid}?source=musicbrainz` |
| `getArtistAlbums(mbid, limit)` | `GET /api/artists/{mbid}/albums?source=musicbrainz&limit={limit}` |
| `getArtistTopRecordings(mbid, limit)` | `GET /api/artists/{mbid}/tracks?source=musicbrainz&limit={limit}` |
| `searchArtistsByTag(tag, limit)` | `GET /api/genres/{genreId}/artists?source=musicbrainz&limit={limit}` |
| `searchRecordingsByTag(tag, limit)` | `GET /api/genres/{genreId}/tracks?source=musicbrainz&limit={limit}` |
| `fetchArtistImage(name)` | viene en `UnifiedArtist.image`, o `GET /api/artists/{id}/image?source=musicbrainz` |
| `coverArtUrl(rgId)` | ya viene en `UnifiedAlbum.imageUrl` |

### `src/lib/spotify.ts`
| Función actual | Nuevo endpoint |
|---|---|
| `searchArtistByName(name, limit)` | `GET /api/search/artists?source=spotify&q={name}&limit={limit}` |
| `getArtistById(id)` | `GET /api/artists/{id}?source=spotify` |
| `getArtistAlbums(id, limit)` | `GET /api/artists/{id}/albums?source=spotify&limit={limit}` |
| `getArtistTopTracks(id)` | `GET /api/artists/{id}/tracks?source=spotify` |
| `searchArtistsByGenre(genre, limit)` | `GET /api/genres/{genreId}/artists?source=spotify&limit={limit}` |
| `searchTracksByGenre(genre, limit)` | `GET /api/genres/{genreId}/tracks?source=spotify&limit={limit}` |
| `getAccessToken()`, `spToUnified*()` | **eliminar** — el backend gestiona token y normalización |

### `src/lib/lastfm.ts`
| Función actual | Nuevo endpoint |
|---|---|
| `searchArtistByName(name, limit)` | `GET /api/search/artists?source=lastfm&q={name}&limit={limit}` |
| `getArtistById(id)` | `GET /api/artists/{id}?source=lastfm` |
| `getArtistAlbums(id, limit)` | `GET /api/artists/{id}/albums?source=lastfm&limit={limit}` |
| `getArtistTopTracks(id, limit)` | `GET /api/artists/{id}/tracks?source=lastfm&limit={limit}` |
| `searchArtistsByTag(tag, limit)` | `GET /api/genres/{genreId}/artists?source=lastfm&limit={limit}` |
| `searchTracksByTag(tag, limit)` | `GET /api/genres/{genreId}/tracks?source=lastfm&limit={limit}` |
| `fetchArtistImage(id)` | viene en `UnifiedArtist.image`, o `GET /api/artists/{id}/image?source=lastfm` |
| `lfmToUnified*()` | **eliminar** — lo hace el backend |

### `src/lib/audiodb.ts`
| Función actual | Nuevo endpoint |
|---|---|
| `fetchArtistImageByMBID` / `fetchArtistImageByName` | **eliminar** — absorbido en `GET /api/artists/:id/image` |

### `src/data/genres.ts`
| Actual | Nuevo |
|---|---|
| `GENRES` (array estático) | `GET /genres` al iniciar la app |
| `FAMILIES` | `GET /families` (el `color` se sigue resolviendo en el front) |

---

## Resumen de cambios en el front

1. Añadir `VITE_API_URL`; quitar `VITE_SPOTIFY_*` y `VITE_LASTFM_*`.
2. Reescribir el cuerpo de las funciones de `src/lib/` para llamar a la API (mismas firmas/tipos).
3. En modo Género, pasar `genreId` (no un tag) a `/api/genres/:id/...`.
4. Cargar `GENRES`/`FAMILIES` desde la API en vez del archivo estático.
5. (Opcional, nuevo) Login/registro, favoritos e historial de visitas con los endpoints de arriba.
