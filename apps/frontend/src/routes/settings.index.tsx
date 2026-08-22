import { createFileRoute } from "@tanstack/react-router";

import { redirectFromSettingsIndex } from "@/features/settings/lib/settings-index-redirect";
import { settingsSearchSchema } from "@/features/settings/types/settings-search";

export const Route = createFileRoute("/settings/")({
  validateSearch: settingsSearchSchema,
  beforeLoad: ({ search }) => redirectFromSettingsIndex(search),
});
