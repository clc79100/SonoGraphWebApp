# Sonograph — Atlas interactivo de géneros musicales

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 + SWC |
| UI | shadcn/ui (Radix primitives) + Tailwind CSS 3 |
| Testing | Vitest 3 + jsdom + Testing Library |
| Graph | react-force-graph-2d (force-graph) |
| Routing | react-router-dom 6 |
| Data fetching | TanStack Query (bundled, **no se usa** — llamadas directas con `fetch`) |
| Backend APIs | MusicBrainz REST (pública, sin API key), Wikipedia REST |
| Package managers | npm (principal), bun (lockfiles presentes) |
| Lint | ESLint 9 + typescript-eslint |
| Icons | lucide-react |

## Estructura del proyecto

```
src/
├── main.tsx              # Entrypoint
├── App.tsx               # Router, QueryClient, TooltipProvider
├── index.css             # Tailwind + variables CSS (modo oscuro fijo)
├── components/
│   ├── ui/               # shadcn/ui components (49 archivos)
│   ├── GenreGraph.tsx     # Grafo force-directed interactivo
│   ├── GenreDetail.tsx    # Panel lateral detalle de género
│   ├── ArtistDetail.tsx   # Panel lateral detalle de artista
│   ├── GraphControls.tsx  # Panel izquierdo (búsqueda, familias)
│   └── NavLink.tsx
├── lib/
│   ├── musicbrainz.ts     # API MusicBrainz + Wikipedia (cachés en Map)
│   └── utils.ts           # cn() utility
├── data/
│   └── genres.ts          # Dataset curado: 300+ géneros, 17 familias
├── pages/
│   ├── Index.tsx          # Página principal (grafo + paneles)
│   └── NotFound.tsx
├── hooks/                 # use-mobile, use-toast
├── test/
│   └── setup.ts           # Vitest setup (matchMedia mock)
└── vite-env.d.ts
```

## Datos del grafo

- `src/data/genres.ts` contiene 300+ géneros organizados en **17 familias** (rock, metal, electronic, pop, hiphop, etc.)
- Cada género tiene: `id`, `name`, `family`, opcionalmente `parents[]` y `related[]` para edges del grafo
- `FAMILIES` array define las familias con nombre y color CSS
- `GENRES` array contiene todos los géneros del grafo

## APIs externas

### MusicBrainz (`src/lib/musicbrainz.ts`)
- API REST pública (`https://musicbrainz.org/ws/2`)
- Rate limit ~1 request/second (no documentado, práctico respetarlo)
- Funciones: `searchArtistsByTag`, `searchArtistsByName`, `getArtistDetails`, `getArtistTopRecordings`, `getArtistAlbums`, `searchRecordingsByTag`
- Imágenes vía Wikipedia REST (`en.wikipedia.org/api/rest_v1/page/summary/`) y CoverArtArchive
- **Todas las llamadas usan cachés en `Map`** (artista, álbumes, grabaciones, imágenes)

### Spotify (a implementar — Tarea 2)
- Se agregará en `src/lib/spotify.ts`
- Usa Client Credentials grant con `VITE_SPOTIFY_CLIENT_ID` y `VITE_SPOTIFY_CLIENT_SECRET`

## Convenciones y particularidades

- **Solo modo oscuro** — `class="dark"` fijo en `<html>`, sin toggle. CSS variables definidas en `:root` en `src/index.css`
- **Idioma:** español (`lang="es"` en HTML, textos en español en toda la UI)
- **Alias `@/`** mapea a `./src/`
- **`strict: false`**, `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false` en tsconfig
- **`@typescript-eslint/no-unused-vars` desactivado** en eslint
- **Variables env** necesitan prefijo `VITE_` para exponerse al cliente Vite
- Plugin `lovable-tagger` solo activo en modo development

## Comandos

| Comando | Descripción |
|---------|------------|
| `npm run dev` | Servidor dev en **puerto 8080** |
| `npm run build` | Build producción → `dist/` |
| `npm run build:dev` | Build modo development |
| `npm run preview` | Previsualizar build producción |
| `npm test` | Vitest (jsdom, globales) |
| `npm run test:watch` | Vitest en modo watch |
| `npm run lint` | ESLint (ignora `dist/`) |

---

# Tareas pendientes

Desglose de tareas con orden de ejecución y dependencias.

---

## Fase 1 — Preparación (sin dependencias)

### Tarea 1: Renombrar variables .env para Vite

**Archivo:** `.env`

Vite solo expone variables con prefijo `VITE_` al cliente. Cambiar:
- `SPOTIFY_CLIENT_ID` → `VITE_SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET` → `VITE_SPOTIFY_CLIENT_SECRET`

**Razón:** `import.meta.env.VITE_SPOTIFY_CLIENT_ID` funcionará en el navegador.

---

### Tarea 2: Servicio Spotify API (`src/lib/spotify.ts`)

Paralela a Tarea 1. Implementar:

- Tipos: `SPArtist`, `SPAlbum`, `SPTrack`, `SPArtistDetails`
- `getAccessToken()` — Client Credentials grant con `VITE_SPOTIFY_CLIENT_ID` y `VITE_SPOTIFY_CLIENT_SECRET`, cachear token hasta expirar
- `searchArtistByName(name)` → `SPArtist[]`
- `getArtistById(id)` → `SPArtistDetails`
- `getArtistAlbums(id, limit?)` → `SPAlbum[]`
- `getArtistTopTracks(id)` → `SPTrack[]`
- Cachés en `Map` igual que `musicbrainz.ts`
- `fetchArtistImage(id)` — usar imagen de perfil de Spotify (más confiable que Wikipedia)

**Formato compartido** (para que `ArtistDetail` pueda intercambiar fuentes):

| Campo | MusicBrainz | Spotify |
|-------|-------------|---------|
| artist.id | MB mbid | Spotify URI (id) |
| artist.name | name | name |
| artist.image | Wikipedia thumbnail | `images[0]?.url` |
| album.id | release-group mbid | album id |
| album.title | title | name |
| album.image | coverartarchive.org | `images[0]?.url` |
| album.year | firstReleaseDate[0:4] | release_date[0:4] |
| track.id | recording mbid | track id |
| track.title | title | name |
| track.duration | length (ms) | duration_ms |
| track.album | — | album.name |

---

## Fase 2 — Infraestructura de fuente configurable

### Tarea 3: DataSourceContext

**Archivo nuevo:** `src/context/DataSourceContext.tsx`

```tsx
type DataSource = "musicbrainz" | "spotify";
```

- Crear contexto + provider
- Provider guarda estado `DataSource`
- Envolver `<App />` en `main.tsx` (o en `App.tsx` dentro del `QueryClientProvider`)
- Exportar hook `useDataSource()`

**Dependencia:** Tarea 1 (para `VITE_` vars)

---

### Tarea 4: Selector de fuente en UI

Agregar un toggle "Fuente" en la UI. Opciones:

1. Dentro del panel de `GraphControls.tsx`, al final del panel izquierdo (después de la sección "Familias"), agregar un pequeño selector con dos botones: `🎵 MusicBrainz` / `🟢 Spotify`
2. Visualmente similar al toggle de modo búsqueda (Género / Artista) que ya existe

**Archivos:** `src/components/GraphControls.tsx`

**Dependencia:** Tarea 3

---

### Tarea 5: Adaptar ArtistDetail para fuente dual

**Archivo:** `src/components/ArtistDetail.tsx`

Modificar para que use `useDataSource()` y llame a spotify.ts o musicbrainz.ts según la fuente activa:

- Crear funciones unificadas (o un hook `useArtistData`) que:
  - Según `dataSource`, llaman a musicbrainz o spotify
  - Mapean resultados al formato común (tipos unificados)
  - Manejan caché
- Ajustar props — ya no recibirán solo MBArtist, sino un tipo unificado
- Actualizar `GraphControls.tsx` y `Index.tsx` para usar el tipo unificado

**Dependencia:** Tareas 2, 3

---

## Fase 3 — Mejoras visuales en ArtistDetail

### Tarea 6: Imagen de artista circular y redimensionada

**Archivo:** `src/components/ArtistDetail.tsx` (líneas 111-125)

Cambiar el hero photo actual (cuadrado grande, `aspect-square`) por un avatar circular más pequeño:

```tsx
<div className="flex justify-center">
  <Avatar className="h-24 w-24 border-2 border-border shadow-md">
    <AvatarImage src={image} alt={name} />
    <AvatarFallback className="text-lg">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
  </Avatar>
</div>
```

---

### Tarea 7: Grid de álbumes 3 → 2 columnas

**Archivo:** `src/components/ArtistDetail.tsx` (línea 221)

Cambiar `grid-cols-3` → `grid-cols-2`.

---

### Tarea 8: Botón "Expandir" + nueva ventana flotante

**Archivo:** `src/components/ArtistDetail.tsx`

- Agregar botón con icono `Maximize2` o `ExternalLink` en el header (junto al botón de cerrar)
- Al hacer click, abrir un nuevo componente `ArtistExpandedView` como un modal overlay

---

### Tarea 9: Componente ArtistExpandedView

**Archivo nuevo:** `src/components/ArtistExpandedView.tsx`

- Modal/overlay centrado con fondo semi-transparente
- Tamaño: ~90vw x 85vh, border redondeado, scroll si es necesario
- Header con nombre del artista y botón cerrar

**Layout interior:**

```text
┌──────────────────────────────────────────┐
│  Nombre Artista                    [✕]   │
├──────────────────────────────────────────┤
│  Álbumes ← [1][2][3][4][5]... →         │
│          [6][7][8][9][10]...             │
│  (horizontal scroll, 2 filas)            │
├──────────────────────────────────────────┤
│  Canciones (3 filas, scroll vertical)     │
│  ┌───────────────────┐                    │
│  │ 1. Canción A      │                    │
│  │ 2. Canción B      │                    │
│  │ 3. Canción C      │                    │
│  │ ...               │                    │
│  └───────────────────┘                    │
└──────────────────────────────────────────┘
```

- Álbumes en grid horizontal con `overflow-x-auto`, 2 filas, cards cuadradas
- Canciones en lista vertical con 3 filas (columnas), usando grid `grid-cols-3`

**Dependencia:** Tarea 5 (usa los datos del artista)

---

## Orden de ejecución recomendado

```
Fase 1:
  T1 (.env rename) ──┐
  T2 (spotify.ts)  ──┤  (paralelo)
Fase 2:
  T3 (contexto)    <──┤
  T4 (selector UI) <──┤
  T5 (artist dual) <──┤
Fase 3:
  T6 (avatar circular) ──┐  (paralelo entre sí,
  T7 (grid 2 cols)    ──┤   pero después de T5
  T8+T9 (floating)    ──┘   porque usan ArtistDetail)
```

---

## Pendientes / blockers

- **Credenciales Spotify:** Reemplazar `VITE_SPOTIFY_CLIENT_ID` y `VITE_SPOTIFY_CLIENT_SECRET` en `.env` por los de una app registrada con una cuenta que tenga **Spotify Premium activo**. Sin Premium, `/v1/search` y demás endpoints retornan error aunque el token se genere correctamente. Ver `src/lib/spotify.ts` — `SpotifyAPIError` con código `"premium_required"`.

---

## Archivos a crear
- `src/lib/spotify.ts`
- `src/context/DataSourceContext.tsx`
- `src/components/ArtistExpandedView.tsx`

## Archivos a modificar
- `.env` (renombrar vars)
- `src/components/GraphControls.tsx` (toggle fuente)
- `src/components/ArtistDetail.tsx` (fuente dual, avatar, grid 2 cols, botón expandir)
- `src/App.tsx` o `src/main.tsx` (envolver con DataSourceProvider)
