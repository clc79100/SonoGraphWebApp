# SonoGraph WebApp — Plan y registro de pruebas

Documento específico del **frontend** (`SonoGraphWebApp`). Aquí se documenta todo lo
relativo a pruebas del cliente: **unitarias** (Vitest), **E2E** (Playwright), accesibilidad
y compatibilidad. El plan global de calidad (13 puntos, estrategia por capa, criterios,
riesgos) vive en `../TEST-PLAN.md`. El plan de la API está en `../SonoGraphAPI/TEST-PLAN.md`.

> Estos dos `TEST-PLAN.md` (frontend + API) son el **contexto de pruebas** para que un
> agente redacte el documento final de calidad con lo realmente implementado.

| Metadato | Valor |
|---|---|
| Componente | `SonoGraphWebApp` (Vite + React 18 + TypeScript) |
| Runner | **Vitest 3** + jsdom + Testing Library |
| Cobertura | provider `v8` |
| Fecha | 2026-06-21 |
| Estado | Unitarias ✅ · E2E (Playwright) ✅ · A11y/Compat ⏳ |

---

## 1. Configuración del entorno de pruebas

**Dependencias:** `vitest`, `@vitest/coverage-v8`, `jsdom`, Testing Library (ya presentes).

**Scripts (`package.json`):**

| Comando | Acción |
|---|---|
| `npm run test` | Ejecuta los specs una vez (`vitest run`) |
| `npm run test:watch` | Modo watch |
| `npm run test:cov` | Tests + cobertura + gate de umbrales |

**`vitest.config.ts`:** entorno `jsdom`, `globals: true`, `setupFiles` con mock de
`matchMedia`. Cobertura enfocada en la **capa de dominio** bajo prueba con umbrales:

```
lines 90 · statements 90 · functions 90 · branches 75
```

---

## 2. Pruebas unitarias ✅ (Checklist §3)

### 2.1 Qué se prueba

Funciones **puras** de dominio/transformación, aisladas. Para testear `buildGraph` sin
arrastrar `react-force-graph-2d` (canvas, incompatible con jsdom), se **extrajo** a un
módulo puro:

| Módulo | Cambio | Funciones probadas |
|---|---|---|
| `src/data/graph.ts` (nuevo) | `buildGraph` extraído de `GenreGraph.tsx`, ahora recibe `genres` como parámetro | `buildGraph` |
| `src/data/genreStore.ts` | sin cambios | `loadGenres`, `getGenreById`, `getFamilyColor`, `getGenres`, `getFamilies` |
| `src/lib/utils.ts` | sin cambios | `cn` |

`GenreGraph.tsx` ahora importa `buildGraph`/tipos desde `@/data/graph` y llama
`buildGraph(GENRES)` (comportamiento idéntico).

### 2.2 Specs

| Spec | Casos | Reglas de negocio clave verificadas |
|---|---|---|
| `src/data/genreStore.spec.ts` | 8 | `loadGenres` mapea parents/related con defaults; carga familias con color CSS; `getGenreById` hit/undefined; `getFamilyColor` familia cargada vs fallback; **propaga error** si falla el backend |
| `src/data/graph.spec.ts` | 5 | un nodo por género; aristas `parent`/`related`; ignora referencias inexistentes; `val` mayor cuando hay más hijos |
| `src/lib/utils.spec.ts` | 3 | `cn` combina clases, resuelve conflictos Tailwind, ignora falsy |

`apiFetch` se **mockea** (`vi.mock("@/lib/api")`) para que `loadGenres` no toque la red.

### 2.3 Buenas prácticas aplicadas (PDF §3.2)

- **AAA** explícito en cada test.
- **Nombres descriptivos** anidados (`describe` → `describe` → `it`).
- **Una aserción / un concepto** por test.
- **Sin `if`/`else` ni bucles** dentro de los tests.
- **Tests independientes** (estado de `genreStore` recargado en `beforeEach`).

### 2.4 Resultado de ejecución

```
Test Files  4 passed (4)      (incluye el example.test.ts previo)
Tests       17 passed (17)

% Coverage (src/data/graph.ts, src/data/genreStore.ts, src/lib/utils.ts)
Statements : 100%
Functions  : 100%
Lines      : 100%
Branches   :  80.64%   ← gate 75
```

✅ Cumple el objetivo de **cobertura de dominio ≥90%** en statements/functions/lines.

### 2.5 Casos de prueba (referencia)

| ID | Caso | Esperado |
|---|---|---|
| `TC-UNIT-FE-001` | `getGenreById('rock')` | género con `name: 'Rock'` |
| `TC-UNIT-FE-002` | `getGenreById('no-existe')` | `undefined` |
| `TC-UNIT-FE-003` | `getFamilyColor('metal')` sin cargar familia | `hsl(var(--family-metal))` (fallback) |
| `TC-UNIT-FE-004` | `buildGraph` con padre existente | arista `{source:'rock',target:'alt-rock',kind:'parent'}` |
| `TC-UNIT-FE-005` | `cn('p-2','p-4')` | `'p-4'` (resuelve conflicto) |

---

## 3. Hallazgos / issues detectados (pre-existentes)

> No causados por el trabajo de pruebas; detectados al ejecutar build/lint. Candidatos a `BUG`.

- **`BUG` (RESUELTO) — build roto por falta de `src/pages/`.** `src/App.tsx` importaba
  `./pages/Index.tsx` y `./pages/NotFound` con el directorio ausente → `npm run build`
  fallaba. **Corregido** (se restauró `src/pages/`); `npm run build` ahora compila (`✓ built`).
- **Gap de calidad TS (ya documentado en `../TEST-PLAN.md` §14):** `tsconfig` del frontend
  no usa `strict`; `GenreGraph.tsx` tiene varios `no-explicit-any` (errores de ESLint
  pre-existentes en el cuerpo del componente, no en los módulos nuevos).

---

## 4. Pruebas E2E ✅ (Checklist §5)

**Herramienta:** **Playwright** (`@playwright/test`, navegador Chromium). Config en
`playwright.config.ts` (`testDir: ./e2e`, `baseURL: http://localhost:8080`, `workers: 1`
para no saturar el rate-limit de MusicBrainz, `screenshot: only-on-failure`).

**Prerrequisito (app real corriendo):**

| Servicio | Comando | Puerto |
|---|---|---|
| Frontend | `npm run dev` | 8080 |
| API | `../SonoGraphAPI` → `npm run start:dev` | 3000 |
| Redis | `docker run -d -p 6379:6379 redis:7-alpine` | 6379 |
| Postgres | Supabase (cloud, vía `.env` de la API) | — |

**`data-testid` añadidos** (cambio pasivo en React):

| Componente | testids |
|---|---|
| `GraphControls` | `login-button`, `logout-button`, `mode-genre`, `mode-artist`, `search-input`, `artist-result` |
| `AuthModal` | `tab-login`, `tab-register`, `login-email`, `login-password`, `login-submit`, `register-email`, `register-password`, `register-submit`, `auth-error` |
| `ArtistDetail` | `artist-fav-button` |

**Flujos automatizados (PDF §5.1, los 3 core):**

| ID | Spec | Flujo | Aserción |
|---|---|---|---|
| `TC-E2E-001` | `e2e/auth.spec.ts` | Registro nuevo (+ validación: contraseña corta → error) | sesión iniciada (header con email) |
| `TC-E2E-002` | `e2e/auth.spec.ts` | Login/Logout con credenciales válidas **e inválidas** | error en inválidas; sesión en válidas |
| `TC-E2E-003` | `e2e/core.spec.ts` | Buscar artista (modo Artista) → detalle → marcar favorito | `aria-label` del botón pasa a "Quitar de favoritos" |

> Flujo core operado vía **buscador** (el grafo es canvas, no DOM). Búsqueda contra
> MusicBrainz real. Emails únicos por corrida (`e2e-<timestamp>@sono.test`) para evitar 409.

**Buenas prácticas aplicadas (PDF §5.2):** selectores `data-testid`; helper reutilizable
(`registerNewUser`); tests independientes; screenshots por paso.

**Resultado de ejecución:** `npx playwright test` → **3 passed**. Evidencia en
`screenshots/` (7 capturas: validación/registro, login inválido/válido, resultados,
detalle de artista, favorito marcado).

**Comando:** `npm run test:e2e`.

> **Nota técnica:** el `tab` del `AuthModal` persiste entre aperturas y Radix desmonta la
> pestaña inactiva → en el flujo de login tras un registro hay que click en `tab-login`
> antes de usar los campos de login.


## 5. Accesibilidad y compatibilidad ✅ (Checklist §8)

**Herramientas:** `@axe-core/playwright` (WCAG 2.1 AA automatizado), **Lighthouse** (CLI),
**Playwright multi-proyecto** (6 combinaciones navegador/viewport).

### 5.1 Ajustes de aria/label aplicados (pre-requisito)

Antes de automatizar la auditoría, se corrigieron los siguientes puntos de accesibilidad
en los componentes React:

| Componente | Cambio |
|---|---|
| `AuthModal.tsx` | `aria-label` en los 4 inputs de email/password; `role="alert"` + `id` único en el `<p>` de error; `aria-describedby` en el formulario vinculando inputs con error |
| `GraphControls.tsx` | `aria-label` en search input, login/logout, mode toggle (con `role="radio"`/`aria-checked`), source selector, familia expand/toggle, genre chips, artist results, limpiar filtros; `aria-live="polite"` + `role="region"` en contenedor de resultados; `role="radiogroup"` en selectores; `focus-visible:ring-2` en todos los botones custom |
| `ArtistDetail.tsx` | `aria-label` en el `<aside>`; `aria-live="polite"` en todos los mensajes de loading/empty; `aria-label` descriptivo en botones de favorito (incluye nombre del track/album); `focus-visible:ring-2` en genre chips, track links y album links; `focus-visible:opacity-100` + `group-focus-within:opacity-100` en botones favorito `opacity-0` |
| `GenreDetail.tsx` | `aria-label` en el `<aside>`; `aria-live="polite"` en loading/empty; `aria-label` en genre chips, artist links, track links y enlaces externos; `focus-visible:ring-2` en todos los `<button>` y `<a>` custom |

### 5.2 WCAG 2.1 con axe-core (automatizado)

**Dependencia:** `@axe-core/playwright` (añadida a `devDependencies`).

**Spec:** `e2e/a11y.spec.ts` — 4 tests que ejecutan `AxeBuilder` con las tags
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`:

| ID | Test | Escenario | Assert |
|---|---|---|---|
| `TC-A11Y-001` | Homepage sin sesión | `page.goto("/")`, esperar botón login | 0 violaciones `critical` |
| `TC-A11Y-002` | Modal login | Abrir AuthModal → pestaña login | 0 violaciones |
| `TC-A11Y-003` | Modal registro | Abrir AuthModal → pestaña registro | 0 violaciones |
| `TC-A11Y-004` | Homepage con sesión | Registrar usuario vía UI, esperar logout button | 0 violaciones `critical` |

### 5.3 Lighthouse

Ejecución **CLI** (no integrada en Playwright). Comando:

```bash
npx lighthouse http://localhost:8080 --output=html --output-path=./lighthouse-report --preset=desktop
```

**Umbrales objetivo:**

| Categoría | Mínimo |
|---|---|
| Performance | ≥ 50 |
| Accessibility | ≥ 85 |
| Best Practices | ≥ 80 |
| SEO | ≥ 80 |

> Lighthouse se ejecuta manualmente (no en CI por ahora) como auditoría complementaria.
> Los resultados se guardan en `lighthouse-report/` con timestamp.

### 5.4 Compatibilidad cross-browser (6 combinaciones)

**Config:** `playwright.config.ts` — se expandió de 1 proyecto a **6 proyectos**:

| Proyecto | Browser | Viewport | Qué ejecuta |
|---|---|---|---|
| `chromium` | Chromium | Desktop Chrome (1280×720) | `auth.spec.ts`, `core.spec.ts`, `a11y.spec.ts` |
| `chromium-1920` | Chromium | 1920×1080 | `smoke.spec.ts`, `a11y.spec.ts` |
| `chromium-1440` | Chromium | 1440×900 | `smoke.spec.ts` |
| `firefox` | Firefox | Desktop Firefox (1280×720) | `smoke.spec.ts` |
| `webkit` | WebKit | Desktop Safari (1280×720) | `smoke.spec.ts` |
| `chromium-ipad` | Chromium | iPad (768×1024) | `smoke.spec.ts` |

**Spec:** `e2e/smoke.spec.ts` — 3 tests ligeros que verifican:

| ID | Test | Assert |
|---|---|---|
| `TC-COMPAT-001` | Carga de homepage con elementos clave | Título SONOGRAPH visible, login button visible, panel familias visible, 0 errores de consola |
| `TC-COMPAT-002` | Modal de login se abre correctamente | Tabs login/register visibles, campos email/password presentes |
| `TC-COMPAT-003` | Alternancia modo género/artista | Click mode-artist → search visible; click mode-genre → search visible |

### 5.5 Resultado de ejecución

```bash
# Solo functional + a11y en chromium (rápido)
npx playwright test --project=chromium

# Smoke tests en todas las combinaciones
npx playwright test --project=chromium-1920 --project=chromium-1440 --project=firefox --project=webkit --project=chromium-ipad

# Todo
npm run test:e2e
```

> **Limitación conocida:** el grafo en `<canvas>` no es navegable por teclado. Se ofrece
> el **buscador de artistas** como ruta accesible equivalente (documentado en el plan
> global §3.6.a).

### 5.6 Comandos

| Comando | Acción |
|---|---|
| `npm run test:e2e` | Todos los tests E2E (functional + a11y + smoke en todos los proyectos) |
| `npx playwright test --project=chromium` | Solo functional + a11y (rápido, 1 proyecto) |
| `npx lighthouse http://localhost:8080 --output=html` | Auditoría Lighthouse manual |

---

## Cómo ejecutar

```bash
npm install
npm run test:cov     # unitarias + cobertura
npm run test         # unitarias
npx playwright test --ui # Ejecutar pruebas UI
```
