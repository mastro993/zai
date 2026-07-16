import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { ThemeProvider } from "next-themes";

import { getRouter } from "./router";

import "./styles.css";

const router = getRouter();
const rootElement = document.getElementById("root");

if (rootElement === null) {
  document.body.textContent = "Zai could not start because the app root is missing.";
} else if (import.meta.env.VITE_ZAI_BUILD_TARGET === "tauri" && !isTauri()) {
  rootElement.textContent =
    "This desktop frontend must be opened by Tauri. Run `pnpm dev:tauri` and use the Zai window.";
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        disableTransitionOnChange
        enableColorScheme
        enableSystem
        storageKey="zai-theme"
      >
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  );
}
