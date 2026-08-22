import { redirect } from "@tanstack/react-router";

import type { SettingsSearch } from "../types/settings-search";

export function redirectFromSettingsIndex(search: SettingsSearch): never {
  if (search.focus !== undefined) {
    throw redirect({
      to: "/settings/currencies",
      search: { focus: search.focus },
    });
  }

  throw redirect({ to: "/settings/appearance" });
}
