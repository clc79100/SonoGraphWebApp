# Sonograph — Web App

Atlas interactivo de géneros musicales. El usuario explora un grafo de fuerzas donde
cada nodo es un género y los enlaces representan relaciones jerárquicas (padre→hijo) o
de afinidad. Permite navegar géneros, buscar artistas y ver detalle de artistas, álbumes
y tracks, además de marcar favoritos por usuario autenticado.

Este repositorio contiene **solo el frontend**. Consume una API externa
(SonGraphAPI) para géneros, autenticación, favoritos y como proxy de las fuentes
musicales (MusicBrainz / Spotify / Last.fm).

---

## Stack

- **Build/runtime**: Vite + React 18 + TypeScript
- **UI**: shadcn/ui (Radix) + Tailwind CSS 3
- **Grafo**: react-force-graph-2d (canvas 2D)
- **Routing**: react-router-dom
- **Data fetching/estado servidor**: @tanstack/react-query
- **Estado de cliente**: useState local + Context (`AuthContext`, `DataSourceContext`)
- **Tests**: Vitest
- **Dev server**: puerto 8080

---

## Puesta en marcha

```bash
# instalar dependencias (bun o npm — hay bun.lock y package-lock.json)
npm install        # o: bun install

# variables de entorno
# crear .env con la URL del backend:
#   VITE_API_URL=http://localhost:3000

npm run dev        # arranca Vite en http://localhost:8080
```

### Scripts

| Comando | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite, puerto 8080) |
| `npm run build` | Build de producción a `dist/` |
| `npm run build:dev` | Build en modo development |
| `npm run preview` | Sirve el build de `dist/` |
| `npm run lint` | ESLint sobre todo el proyecto |
| `npm run test` | Tests con Vitest (una pasada) |
| `npm run test:watch` | Vitest en modo watch |

### Variables de entorno

Solo se necesita una variable pública (prefijo `VITE_`):

- `VITE_API_URL` — base de la API backend. Si falta, se usa `http://localhost:3000`.

> Las credenciales de Spotify / Last.fm **ya no viven en el frontend**: se movieron al
> backend. Aparecen comentadas en `.env` solo como referencia histórica.

---

## Arranque de la app (flujo de inicialización)

`src/main.tsx` es el punto de entrada:

1. Muestra una pantalla "Cargando géneros…".
2. Llama a `loadGenres()` (`GET /genres` + `GET /families`) **antes** de montar React.
3. Monta `<App />`, que envuelve la app en los providers:
   `QueryClientProvider → AuthProvider → DataSourceProvider → TooltipProvider → BrowserRouter`.

Rutas (`src/App.tsx`): `/` → `Index`, catch-all `*` → `NotFound`.

---

## Estructura del proyecto

```
src/
├── main.tsx                  # entry point; carga géneros y monta React
├── App.tsx                   # providers + rutas
├── index.css / App.css       # estilos globales y tokens de tema (CSS vars de familias)
├── pages/
│   ├── Index.tsx             # pantalla principal: orquesta grafo + sidebars + modales
│   └── NotFound.tsx
├── components/
│   ├── GenreGraph.tsx        # render del grafo de fuerzas (canvas)
│   ├── GraphControls.tsx     # buscador + toggle Género/Artista + filtros de familia
│   ├── GenreDetail.tsx       # sidebar de un género (artistas y tracks de la fuente)
│   ├── ArtistDetail.tsx      # sidebar de un artista (géneros, top tracks, álbumes)
│   ├── ArtistExpandedView.tsx# vista expandida estilo Apple Music
│   ├── AuthModal.tsx         # login / registro
│   ├── NavLink.tsx
│   └── ui/                   # componentes shadcn/ui (Radix)
├── context/
│   ├── AuthContext.tsx       # auth: login/register/logout, tokens, refresh en 401
│   └── DataSourceContext.tsx # fuente activa (musicbrainz | spotify | lastfm)
├── data/
│   ├── genres.ts             # re-export de genreStore (compat de imports)
│   └── genreStore.ts         # estado de géneros/familias cargado del backend
├── lib/
│   ├── api.ts                # apiFetch: cliente HTTP con auth y auto-refresh
│   ├── favorites.ts          # CRUD de favoritos (géneros/artistas/tracks/álbumes)
│   ├── musicbrainz.ts        # wrappers de la fuente MusicBrainz (via backend)
│   ├── spotify.ts            # tipos Unified* + wrappers fuente Spotify (via backend)
│   ├── lastfm.ts             # wrappers de la fuente Last.fm (via backend)
│   └── utils.ts              # helpers (cn, etc.)
├── hooks/                    # use-mobile, use-toast
└── test/                     # setup + tests de Vitest
```

---

## Capa de datos

### `lib/api.ts` — cliente HTTP

`apiFetch<T>(path, params?, options?)` es el único punto de salida HTTP de la app:

- Antepone `VITE_API_URL` como base.
- Inyecta `Authorization: Bearer <accessToken>` si hay sesión.
- En `params` arma el query string para GET; para otros métodos usa `body`.
- **Auto-refresh**: ante un `401` con refresh token disponible, llama al handler de
  refresh (registrado por `AuthContext`), reintenta una vez y, si falla, cierra sesión.
- Lanza `Error` con `status` y `code` cuando la respuesta no es OK; trata `204` como vacío.

### `context/AuthContext.tsx` — autenticación

- Persiste `accessToken`, `refreshToken` y `user` en `localStorage`.
- Expone `login`, `register`, `logout`, `user`, `isAuthenticated`.
- Endpoints: `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`,
  `POST /auth/refresh`.
- Registra en `api.ts` el handler de refresh para la intercepción de 401.

### `data/genreStore.ts` — géneros y familias

- Carga géneros y familias del backend con `loadGenres()` (`GET /genres`, `GET /families`).
- Expone `GENRES`, `FAMILIES` (live bindings), `getGenres()`, `getFamilies()`,
  `getGenreById()`, `getFamilyColor()`.
- Los **colores de familia** son responsabilidad del frontend: se mapean a CSS vars
  (`hsl(var(--family-*))`); el backend solo aporta el `id` de familia.
- `data/genres.ts` re-exporta todo esto para no romper imports existentes.

### `lib/favorites.ts` — favoritos (requiere sesión)

CRUD sobre `/users/me/favorites/{genres|artists|tracks|albums}` (GET / POST / DELETE).

### Fuentes musicales — `musicbrainz.ts`, `spotify.ts`, `lastfm.ts`

Las tres comparten los **tipos unificados** definidos en `spotify.ts`
(`UnifiedArtist`, `UnifiedAlbum`, `UnifiedTrack`, `SearchArtist`, `SimpleTrack`) y todas
llaman al backend vía `apiFetch` (ya no pegan directo a las APIs externas). La fuente
activa la decide `DataSourceContext` y se pasa como parámetro `source` en cada request.

---

## Flujo de la UI

`pages/Index.tsx` mantiene el estado de la pantalla y coordina los componentes:

### Modo Género
1. `GenreGraph` construye nodos/aristas desde `GENRES` y los dibuja en canvas.
2. Click en un nodo → `selectedId` → abre `GenreDetail`.
3. `GenreDetail` lee la fuente activa y pide artistas + tracks del género al backend.

### Modo Artista
1. `GraphControls` hace búsqueda debounced según la fuente activa.
2. Seleccionar un resultado → `ArtistDetail` carga datos unificados (géneros, top tracks,
   álbumes, imagen).
3. Los géneros del artista se mapean contra `GENRES` y se iluminan en el grafo
   (`highlightedIds`).
4. Botón "Expandir" → `ArtistExpandedView` (modal con hero image, tracks y grid de álbumes).

---

## Backend

El contrato de la API (endpoints de géneros, auth, favoritos y proxy de fuentes) está
documentado en **`BACKEND.md`** y el contexto de la migración en **`CLAUDE.md`**.
`AGENTS.md` contiene notas para agentes de código.
