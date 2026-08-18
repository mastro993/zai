import { StrictMode, type ReactNode } from "react";

export interface AppBootstrapDependencies<TRouter> {
  isTauri: () => boolean;
  getRouter: () => TRouter;
  render: (root: HTMLElement, tree: ReactNode) => void;
}

export const bootstrapApp = <TRouter,>(
  root: HTMLElement | null,
  buildTarget: string | undefined,
  themeTree: (router: TRouter) => ReactNode,
  deps: AppBootstrapDependencies<TRouter>,
): void => {
  if (root === null) {
    document.body.textContent = "Zai could not start because the app root is missing.";
    return;
  }

  if (buildTarget === "tauri" && !deps.isTauri()) {
    root.textContent =
      "This desktop frontend must be opened by Tauri. Run `pnpm dev:tauri` and use the Zai window.";
    return;
  }

  deps.render(root, <StrictMode>{themeTree(deps.getRouter())}</StrictMode>);
};
