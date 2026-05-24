// Re-exporta todo desde genreStore.ts para mantener compatibilidad de imports.
// Los datos ahora se cargan dinámicamente desde el backend via loadGenres().
export {
  GENRES,
  FAMILIES,
  loadGenres,
  getGenres,
  getFamilies,
  getGenreById,
  getFamilyColor,
} from "./genreStore";
export type { FamilyId, Genre, Family } from "./genreStore";
