import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      // Unidades de dominio bajo prueba en esta iteración (objetivo ≥90%).
      include: ["src/data/graph.ts", "src/data/genreStore.ts", "src/lib/utils.ts"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 75 },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
