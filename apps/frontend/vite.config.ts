import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  envDir: "../..",
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/apps/tauri/**"],
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
