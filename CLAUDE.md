# Sonograph — Contexto para migración a backend

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
- **Estado**: useState local + Context (`DataSourceContext` para la fuente activa)
- **Dev server**: puerto 8080/8081

No hay backend. Todo corre en el browser. Los API keys de Spotify y Last.fm están expuestos en variables de entorno `VITE_*` (visibles en el bundle).

---

## Datos de géneros — estado actual

**Archivo**: `src/data/genres.ts` (~612 líneas, hardcodeado)

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

### Por qué migrar géneros a BD

- Hoy añadir o editar un género requiere un deploy.
- No hay forma de persistir géneros creados por usuarios ni correcciones editoriales.
- La búsqueda de géneros en el grafo es `Array.filter` en memoria; con una BD se puede texto completo, fuzzy search, etc.
- Los colores de familia están en CSS variables (Tailwind); la BD solo necesita el `id` de familia — el color sigue siendo responsabilidad del frontend.

---

## APIs externas — estado actual

Todas las llamadas se hacen **directamente desde el browser**. Cada lib tiene caches en `Map` en memoria (se pierden al recargar).

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

## Puntos de integración en el frontend para la migración

Los cambios en el cliente serían quirúrgicos — los componentes y tipos no cambian:

| Archivo | Qué cambia |
|---|---|
| `src/data/genres.ts` | Reemplazar el array estático por un `GET /genres` al iniciar la app |
| `src/lib/musicbrainz.ts` | Reemplazar calls directas a MB con calls al backend proxy |
| `src/lib/spotify.ts` | Idem Spotify |
| `src/lib/lastfm.ts` | Idem Last.fm |
| `src/lib/audiodb.ts` | Absorber en el endpoint `/api/artists/:id/image` del backend |
| `src/context/DataSourceContext.tsx` | No cambia — `source` sigue siendo parámetro del request |

Los tipos `Unified*`, `SearchArtist`, y todos los componentes de UI no necesitan cambios.
