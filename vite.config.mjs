import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(here, "src", "renderer"),
  base: "./",
  build: {
    outDir: path.join(here, "dist-renderer"),
    emptyOutDir: true,
    target: "chrome142",
  },
});
