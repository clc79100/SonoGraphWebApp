import { apiFetch } from "@/lib/api";

export type FamilyId =
  | "rock" | "metal" | "punk" | "electronic" | "ambient" | "experimental"
  | "pop" | "hiphop" | "rnb" | "jazz" | "blues" | "classical"
  | "folk" | "country" | "latin" | "world" | "reggae";

export interface Genre {
  id: string;
  name: string;
  family: FamilyId;
  parents?: string[];
  related?: string[];
  era?: string;
  region?: string;
  description?: string;
}

export interface Family {
  id: FamilyId;
  name: string;
  color: string;
}

// Module-level state — populated by loadGenres()
// Exported as let so existing imports (GENRES, FAMILIES) stay valid via live bindings
export let GENRES: Genre[] = [];
export let FAMILIES: Family[] = [];
let _loaded = false;

const FAMILY_COLORS: Record<string, string> = {
  rock: "hsl(var(--family-rock))",
  metal: "hsl(var(--family-metal))",
  punk: "hsl(var(--family-punk))",
  electronic: "hsl(var(--family-electronic))",
  ambient: "hsl(var(--family-ambient))",
  experimental: "hsl(var(--family-experimental))",
  pop: "hsl(var(--family-pop))",
  hiphop: "hsl(var(--family-hiphop))",
  rnb: "hsl(var(--family-rnb))",
  jazz: "hsl(var(--family-jazz))",
  blues: "hsl(var(--family-blues))",
  classical: "hsl(var(--family-classical))",
  folk: "hsl(var(--family-folk))",
  country: "hsl(var(--family-country))",
  latin: "hsl(var(--family-latin))",
  world: "hsl(var(--family-world))",
  reggae: "hsl(var(--family-reggae))",
};

export async function loadGenres(): Promise<void> {
  try {
    const [genreData, familyData] = await Promise.all([
      apiFetch<any[]>("/genres"),
      apiFetch<{ id: string; name: string }[]>("/families"),
    ]);

    GENRES = genreData.map((g) => ({
      id: g.id,
      name: g.name,
      family: g.family as FamilyId,
      parents: g.parents ?? [],
      related: g.related ?? [],
      era: g.era,
      region: g.region,
      description: g.description,
    }));

    FAMILIES = familyData.map((f) => ({
      id: f.id as FamilyId,
      name: f.name,
      color: FAMILY_COLORS[f.id] ?? "hsl(var(--family-rock))",
    }));

    _loaded = true;
  } catch (err) {
    console.error("Error al cargar géneros del backend:", err);
    _loaded = false;
    throw err;
  }
}

export function getGenres(): Genre[] {
  if (!_loaded) throw new Error("loadGenres() debe llamarse antes de acceder a los géneros.");
  return GENRES;
}

export function getFamilies(): Family[] {
  if (!_loaded) throw new Error("loadGenres() debe llamarse antes de acceder a las familias.");
  return FAMILIES;
}

export function getGenreById(id: string): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

export function getFamilyColor(familyId: FamilyId): string {
  return FAMILIES.find((f) => f.id === familyId)?.color ?? FAMILY_COLORS[familyId] ?? "hsl(0, 0%, 50%)";
}
