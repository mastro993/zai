import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { ThemeProvider } from "next-themes";

import { bootstrapApp } from "./app-bootstrap";
import { getRouter } from "./router";

import "./styles.css";

bootstrapApp(
  document.getElementById("root"),
  import.meta.env.VITE_ZAI_BUILD_TARGET,
  (router) => (
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
  ),
  {
    isTauri,
    getRouter,
    render: (root, tree) => {
      createRoot(root).render(tree);
    },
  },
);
