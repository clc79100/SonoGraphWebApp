# Sonograph — Contexto del proyecto

> **Estado**: la migración a backend ya está hecha. El frontend ya **no** llama a las
> APIs externas directamente ni hardcodea géneros: todo pasa por la API propia
> (SonGraphAPI) vía `src/lib/api.ts` (`apiFetch`). Las secciones de abajo describen la
> arquitectura actual; el contrato detallado de endpoints está en `BACKEND.md`.

## ¿Qué es Sonograph?

Atlas interactivo de géneros musicales. El usuario ve un grafo de fuerzas (react-force-graph-2d) donde cada nodo es un género musical y los enlaces representan relaciones jerárquicas (padre→hijo) o de afinidad. Tiene dos modos principales:

- **Modo Género**: explorar el grafo, seleccionar un género y ver en un sidebar los artistas y canciones representativos según la fuente activa.
- **Modo Artista**: buscar un artista, ver su sidebar (géneros, top tracks, álbumes, foto) y opcionalmente abrir una vista expandida estilo Apple Music.

El selector de **Fuente** (MusicBrainz / Spotify / Last.fm) afecta tanto las búsquedas de artistas como el contenido del sidebar de géneros.

---

## Stack frontend actual

- **Runtime**: Vite + React 18 + TypeScript
- **UI**: shadcn/ui (Radix primitives) + Tailwind CSS 3
- **Grafo**: react-force-graph-2d (canvas 2D)
- **Estado**: useState local + Context (`DataSourceContext` para la fuente activa,
  `AuthContext` para la sesión)
- **Data fetching**: @tanstack/react-query + `apiFetch` (`src/lib/api.ts`)
- **Dev server**: puerto 8080

El frontend consume la API propia (SonGraphAPI). La única variable de entorno necesaria
es `VITE_API_URL` (base del backend; default `http://localhost:3000`). Las credenciales
de Spotify / Last.fm se movieron al backend y ya **no** están en el bundle (aparecen
comentadas en `.env` solo como referencia histórica).

---

## Datos de géneros — estado actual

**Archivos**: `src/data/genreStore.ts` (estado + carga desde backend) y
`src/data/genres.ts` (re-export de `genreStore` para mantener compatibilidad de imports).

Los géneros y familias se cargan al arrancar la app con `loadGenres()`
(`GET /genres` + `GET /families`), invocado en `src/main.tsx` **antes** de montar React.
`GENRES` y `FAMILIES` se exponen como live bindings; hay helpers `getGenreById()`,
`getFamilyColor()`, etc. Los colores de familia siguen siendo del frontend (CSS vars
`hsl(var(--family-*))`); el backend solo aporta el `id` de familia.

### Tipos clave

```ts
type FamilyId = "rock" | "metal" | "punk" | "electronic" | "ambient" |
  "experimental" | "pop" | "hiphop" | "rnb" | "jazz" | "blues" |
  "classical" | "folk" | "country" | "latin" | "world" | "reggae"; // 17 familias

interface Genre {
  id: string;          // kebab-case, ej: "alternative-rock"
  name: string;        // display, ej: "Alternative Rock"
  family: FamilyId;
  parents?: string[];  // IDs de géneros padre (define aristas del grafo)
  related?: string[];  // IDs de géneros relacionados (aristas débiles)
  era?: string;        // "1980s-90s"
  region?: string;     // "UK", "DE"
  description?: string;
}

interface Family {
  id: FamilyId;
  name: string;   // display en español
  color: string;  // CSS HSL var — solo vive en el frontend
}
```

Hay ~340 géneros y 17 familias. El grafo se construye en `src/components/GenreGraph.tsx` a partir de este array estático con `buildGraph()`.

### Por qué se migraron los géneros a BD (histórico)

- Antes, añadir o editar un género requería un deploy (array hardcodeado).
- No había forma de persistir géneros creados por usuarios ni correcciones editoriales.
- La búsqueda en memoria (`Array.filter`) se puede sustituir por búsqueda server-side.
- Los colores de familia siguen en CSS variables; la BD solo guarda el `id` de familia.

---

## APIs externas — vía backend

El frontend ya **no** llama a MusicBrainz / Spotify / Last.fm / TheAudioDB directamente.
Los libs de `src/lib/` (`musicbrainz.ts`, `spotify.ts`, `lastfm.ts`) son ahora wrappers
finos que llaman al backend mediante `apiFetch`, pasando la fuente activa como parámetro
`source`. El backend oculta las API keys, cachea server-side y normaliza al formato
`Unified*`. La descripción de abajo documenta las **fuentes originales** que el backend
consume internamente (referencia para mantener el backend), no llamadas del browser.

### 1. MusicBrainz (`src/lib/musicbrainz.ts`)

- **Base**: `https://musicbrainz.org/ws/2`
- **Auth**: ninguna (User-Agent recomendado, no implementado aún)
- **Rate limit**: ~1 req/s (no manejado en cliente)
- **Calls activos**:
  - `searchArtistsByName(name, limit)` → `/artist?query=...`
  - `searchArtistsByTag(tag, limit)` → `/artist?query=tag:${tag}` — para sidebar de género
  - `getArtistDetails(mbid)` → `/artist/${mbid}?inc=tags+genres+...`
  - `getArtistAlbums(mbid, limit)` → `/release-group?artist=${mbid}&type=album`
  - `getArtistTopRecordings(mbid, limit)` → `/recording?artist=${mbid}&...`
  - `searchRecordingsByTag(tag, limit)` → `/recording?query=tag:${tag}` — para sidebar de género
  - `fetchArtistImage(name)` → Wikipedia API (busca imagen del artista por nombre)
  - `coverArtUrl(releaseGroupId)` → `https://coverartarchive.org/release-group/${id}/front-250`

### 2. Spotify (`src/lib/spotify.ts`)

- **Base**: `https://api.spotify.com/v1`
- **Auth**: Client Credentials (`VITE_SPOTIFY_CLIENT_ID` + `VITE_SPOTIFY_CLIENT_SECRET`). Token cacheado en memoria.
- **Limitación conocida**: algunos endpoints requieren cuenta Premium en el desarrollador.
- **Calls activos**:
  - `searchArtistByName(name, limit)` → `/search?type=artist`
  - `getArtistById(id)` → `/artists/${id}`
  - `getArtistAlbums(id, limit)` → `/artists/${id}/albums`
  - `getArtistTopTracks(id)` → `/artists/${id}/top-tracks?market=US`
  - `searchArtistsByGenre(genre, limit)` → `/search?q=genre:"${genre}"&type=artist`
  - `searchTracksByGenre(genre, limit)` → `/search?q=genre:"${genre}"&type=track`

### 3. Last.fm (`src/lib/lastfm.ts`)

- **Base**: `https://ws.audioscrobbler.com/2.0/`
- **Auth**: API key en query string (`VITE_LASTFM_API_KEY`). Sin OAuth.
- **Placeholder de imagen**: Last.fm devuelve hash `2a96cbd8b46e442fc41c2b86b821562f` cuando no tiene imagen real; se filtra a `null`.
- **ID de artista**: usa `mbid` si existe, si no `name:${artistName}` (prefijo propio del proyecto).
- **Calls activos**:
  - `searchArtistByName(name, limit)` → `artist.search`
  - `getArtistById(id)` → `artist.getInfo` (resuelve mbid vs name)
  - `getArtistAlbums(id, limit)` → `artist.gettopalbums`
  - `getArtistTopTracks(id, limit)` → `artist.gettoptracks`
  - `searchArtistsByTag(tag, limit)` → `tag.gettopartists`
  - `searchTracksByTag(tag, limit)` → `tag.gettoptracks`

### 4. TheAudioDB (`src/lib/audiodb.ts`)

- **Base**: `https://www.theaudiodb.com/api/v1/json/123` (free key pública, v1)
- **Auth**: key hardcodeada `123`
- **Uso**: fuente primaria de imágenes de artistas para MusicBrainz y Last.fm.
- **Calls activos**:
  - `fetchArtistImageByMBID(mbid)` → `/artist-mb.php?i=${mbid}`
  - `fetchArtistImageByName(name)` → `/search.php?s=${name}`
- **Prioridad de imagen**: AudioDB → imagen de la fuente original (Wikipedia para MB, imagen de LFM para Last.fm). Spotify usa su propia imagen directamente sin pasar por AudioDB.

---

## Tipos unificados (contrato entre fuentes y UI)

Definidos en `src/lib/spotify.ts`, reutilizados por las tres fuentes:

```ts
interface UnifiedArtist {
  id: string;
  name: string;
  genres: string[];       // tags/géneros de la fuente
  image?: string | null;
  country?: string;
  disambiguation?: string;
  type?: string;          // "Group", "Person", etc. (solo MB)
  area?: string;          // ciudad/región (solo MB)
  beginDate?: string;     // solo MB
  endDate?: string;       // solo MB
  externalUrl?: string;   // URL en la fuente (Last.fm, Spotify)
}

interface UnifiedAlbum {
  id: string;
  title: string;
  imageUrl?: string;
  year?: string;
  externalUrl?: string;
}

interface UnifiedTrack {
  id: string;
  title: string;
  duration?: number;      // ms
  album?: string;
  albumImageUrl?: string;
  externalUrl?: string;
}

interface SearchArtist {
  id: string;
  name: string;
  country?: string;
  disambiguation?: string;
  source: "musicbrainz" | "spotify" | "lastfm";
}
```

---

## Flujo de datos por modo

### Modo Género

1. `src/data/genres.ts` → `GenreGraph` construye nodos y aristas → canvas
2. Click en nodo → `selectedId` en `Index.tsx` → abre `GenreDetail`
3. `GenreDetail` lee `useDataSource()` y llama la API correspondiente:
   - MB: `searchArtistsByTag` + `searchRecordingsByTag`
   - LFM: `searchArtistsByTag` + `searchTracksByTag`
   - Spotify: `searchArtistsByGenre` + `searchTracksByGenre`
4. Imágenes de artistas (MB/LFM): AudioDB por MBID → AudioDB por nombre → Wikipedia (solo MB)

### Modo Artista

1. `GraphControls` → búsqueda debounced (350ms) según fuente activa
2. Resultado → click → `ArtistDetail` carga datos unificados de la fuente
3. Géneros del artista se mapean contra `GENRES` local → ilumina nodos del grafo
4. Botón "Expandir" → `ArtistExpandedView` (modal estilo Apple Music) con hero image, top tracks con portadas, grid de álbumes

---

## Qué debe manejar el backend

### 1. Géneros y familias

La BD debe modelar exactamente la estructura de `Genre`. El grafo necesita todos los campos para funcionar. Las familias pueden ser una tabla separada o un enum.

**Endpoints mínimos**:
- `GET /genres` → todos los géneros (para construir el grafo al arrancar)
- `GET /genres/:id` → detalle de un género
- `GET /families` → lista de familias con nombre

Los colores de familia son responsabilidad del frontend (CSS variables); la BD solo necesita el `id` de familia.

### 2. Proxy de APIs externas

El backend expone endpoints propios que internamente llaman a MB, Spotify y LFM. Esto permite ocultar API keys, cachear server-side y normalizar al formato `Unified*` antes de responder al cliente.

**Endpoints sugeridos** (agnósticos de fuente — el cliente solo pasa `source`):

```
# Búsqueda de artistas
GET /api/search/artists?q={name}&source={mb|spotify|lastfm}&limit=10

# Detalle de artista (devuelve UnifiedArtist)
GET /api/artists/:id?source={mb|spotify|lastfm}

# Álbumes del artista (devuelve UnifiedAlbum[])
GET /api/artists/:id/albums?source=...&limit=18

# Top tracks del artista (devuelve UnifiedTrack[])
GET /api/artists/:id/tracks?source=...&limit=12

# Imagen del artista — AudioDB primero, luego fallback de fuente
GET /api/artists/:id/image?source=...

# Artistas por género/tag (devuelve lista simplificada)
GET /api/genres/:genreId/artists?source=...&limit=10

# Tracks por género/tag
GET /api/genres/:genreId/tracks?source=...&limit=12
```

El cliente dejaría de importar los libs de `src/lib/` y solo haría `fetch` al backend propio.

### 3. Cache sugerida

| Recurso | TTL sugerido |
|---|---|
| `GET /genres` | Indefinido (invalidar al editar en BD) |
| Búsquedas de artistas | 1h |
| Detalle artista + álbumes + tracks | 24h |
| Imagen de artista (AudioDB) | 7 días |
| Token de Spotify | ~55 min (expira a los 60) |

### 4. Consideraciones por fuente

- **MusicBrainz**: rate limit ~1 req/s → el backend debe serializar requests o usar una cola. Incluir header `User-Agent: Sonograph/1.0 (contacto)`.
- **Last.fm**: identifica artistas por nombre cuando no hay MBID; el backend mantiene la lógica `name:` vs mbid. Filtrar placeholder de imagen `2a96cbd8b46e442fc41c2b86b821562f`.
- **Spotify**: token Client Credentials se renueva cada ~1h; el backend gestiona el ciclo de vida del token.
- **AudioDB**: free key `123` sin autenticación real, usable desde el backend sin restricción.

---

## Integración frontend ↔ backend (estado actual)

La migración ya se aplicó. Resumen de cómo quedó cada pieza:

| Archivo | Estado |
|---|---|
| `src/data/genreStore.ts` + `genres.ts` | Géneros y familias se cargan con `loadGenres()` (`GET /genres`, `GET /families`) en `main.tsx` |
| `src/lib/api.ts` | Cliente HTTP central (`apiFetch`): base `VITE_API_URL`, `Bearer` token y auto-refresh en 401 |
| `src/lib/musicbrainz.ts` / `spotify.ts` / `lastfm.ts` | Wrappers que llaman al backend vía `apiFetch`, pasando `source` |
| `src/lib/audiodb.ts` | Eliminado — la imagen la resuelve el backend |
| `src/context/DataSourceContext.tsx` | Sin cambios — `source` sigue siendo parámetro del request |
| `src/context/AuthContext.tsx` | **Nuevo** — login/registro/logout, tokens en `localStorage`, refresh |
| `src/lib/favorites.ts` | **Nuevo** — CRUD de favoritos de usuario (géneros/artistas/tracks/álbumes) |

Los tipos `Unified*`, `SearchArtist` (en `src/lib/spotify.ts`) y los componentes de UI no
cambiaron con la migración.

## Autenticación y favoritos

- **Auth** (`AuthContext` + endpoints `/auth/*`): JWT con `accessToken` + `refreshToken`
  persistidos en `localStorage`. `apiFetch` reintenta una vez tras refrescar ante un 401.
- **Favoritos** (`/users/me/favorites/{genres|artists|tracks|albums}`): GET/POST/DELETE,
  requieren sesión.
