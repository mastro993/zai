export const THEME_STORAGE_KEY = "zai-theme";

export type ColorScheme = "light" | "dark";

export function nextStatusBarTheme(
  resolved: ColorScheme,
  system: ColorScheme,
): ColorScheme | undefined {
  const next: ColorScheme = resolved === "dark" ? "light" : "dark";
  return next === system ? undefined : next;
}

export function applyStatusBarTheme(
  next: ColorScheme | undefined,
  setTheme: (theme: string) => void,
  storage: Pick<Storage, "removeItem"> = localStorage,
): void {
  if (next === undefined) {
    setTheme("system");
    storage.removeItem(THEME_STORAGE_KEY);
    return;
  }

  setTheme(next);
}
