import { Result } from "@praha/byethrow";
import { z } from "zod";

import { hasDocument, hasWindow } from "@/lib/runtime-globals";

export const SIDEBAR_PREFERENCE_STORAGE_KEY = "zai-sidebar-preference";
export const SIDEBAR_PREFERENCE_VERSION = 1 as const;
const SIDEBAR_STATE_COOKIE_NAME = "sidebar_state";

export interface SidebarPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface SidebarPreference {
  version: typeof SIDEBAR_PREFERENCE_VERSION;
  open: boolean;
}

const sidebarPreferenceSchema = z.strictObject({
  version: z.literal(SIDEBAR_PREFERENCE_VERSION),
  open: z.boolean(),
});

const getDefaultStorage = (): SidebarPreferenceStorage | null => {
  if (!hasWindow()) {
    return null;
  }

  const result = Result.try({
    try: () => window.localStorage,
    catch: () => null,
  });

  return Result.isSuccess(result) ? result.value : null;
};

const readStoredPreference = (storage: SidebarPreferenceStorage): SidebarPreference | null => {
  const valueResult = Result.try({
    try: (): string | null => storage.getItem(SIDEBAR_PREFERENCE_STORAGE_KEY),
    catch: (): string | null => null,
  });

  if (Result.isFailure(valueResult)) {
    return null;
  }

  const storedValue = valueResult.value;
  if (storedValue === null) {
    return null;
  }

  const parsedResult = Result.try({
    try: () => sidebarPreferenceSchema.safeParse(JSON.parse(storedValue)),
    catch: () => sidebarPreferenceSchema.safeParse(null),
  });

  if (Result.isFailure(parsedResult) || !parsedResult.value.success) {
    return null;
  }

  return parsedResult.value.data;
};

export const readSidebarOpen = (storage?: SidebarPreferenceStorage): boolean => {
  const resolvedStorage = storage ?? getDefaultStorage();
  if (!resolvedStorage) {
    return true;
  }

  const parsed = readStoredPreference(resolvedStorage);
  return parsed ? parsed.open : true;
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

export const clearSidebarStateCookie = (): void => {
  if (!hasDocument()) {
    return;
  }

  const result = Result.try({
    try: () => {
      document.cookie = `${SIDEBAR_STATE_COOKIE_NAME}=; path=/; max-age=0`;
    },
    catch: () => undefined,
  });

  void result;
};
