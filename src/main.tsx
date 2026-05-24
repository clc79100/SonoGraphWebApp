import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { loadGenres } from "./data/genres";
import "./index.css";

async function main() {
  const root = document.getElementById("root")!;
  root.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:hsl(222,18%,7%);font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:hsl(215,14%,55%);">
      Cargando géneros…
    </div>`;

  try {
    await loadGenres();
  } catch (err) {
    console.error("Error al cargar datos iniciales:", err);
  }

  createRoot(root).render(<App />);
}

main();
