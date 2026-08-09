import { Result } from "@praha/byethrow";
import { z } from "zod";

export const SIDEBAR_PREFERENCE_STORAGE_KEY = "zai-sidebar-preference";
export const SIDEBAR_PREFERENCE_VERSION = 1 as const;

export interface SidebarPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const sidebarPreferenceSchema = z.strictObject({
  version: z.literal(SIDEBAR_PREFERENCE_VERSION),
  open: z.boolean(),
});

const getDefaultStorage = (): SidebarPreferenceStorage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const result = Result.try({
    try: () => window.localStorage,
    catch: () => null,
  });

  return Result.isSuccess(result) ? result.value : null;
};

const readStoredValue = (storage: SidebarPreferenceStorage): unknown => {
  const valueResult = Result.try({
    try: () => storage.getItem(SIDEBAR_PREFERENCE_STORAGE_KEY),
    catch: () => null,
  });

  if (Result.isFailure(valueResult)) {
    return null;
  }

  const storedValue = valueResult.value;
  if (storedValue === null) {
    return null;
  }

  const jsonResult = Result.try({
    try: () => JSON.parse(storedValue) as unknown,
    catch: () => null,
  });

  return Result.isSuccess(jsonResult) ? jsonResult.value : null;
};

export const readSidebarOpen = (storage?: SidebarPreferenceStorage): boolean => {
  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) {
    return true;
  }

  const parsed = sidebarPreferenceSchema.safeParse(readStoredValue(resolvedStorage));
  return parsed.success ? parsed.data.open : true;
};

export const writeSidebarOpen = (open: boolean, storage?: SidebarPreferenceStorage): void => {
  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) {
    return;
  }

  const result = Result.try({
    try: () =>
      resolvedStorage.setItem(
        SIDEBAR_PREFERENCE_STORAGE_KEY,
        JSON.stringify({ version: SIDEBAR_PREFERENCE_VERSION, open }),
      ),
    catch: () => undefined,
  });

  void result;
};
