import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { getRouter } from "./router";

import "./styles.css";

const router = getRouter();
const rootElement = document.getElementById("root");

if (rootElement === null) {
  document.body.textContent = "Zai could not start because the app root is missing.";
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
