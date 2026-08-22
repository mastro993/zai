import { createFileRoute } from "@tanstack/react-router";

import { CurrenciesSettingsScreen } from "@/features/settings/screens/currencies-settings-screen";
import { settingsSearchSchema } from "@/features/settings/types/settings-search";

export const Route = createFileRoute("/settings/currencies")({
  validateSearch: settingsSearchSchema,
  component: CurrenciesSettingsPage,
});

function CurrenciesSettingsPage() {
  const search = Route.useSearch();

  return (
    <CurrenciesSettingsScreen
      focusRates={search.focus === "rates"}
      focusAdd={search.focus === "currencies"}
    />
  );
}
