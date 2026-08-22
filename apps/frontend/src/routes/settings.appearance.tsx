import { createFileRoute } from "@tanstack/react-router";

import { AppearanceSettingsScreen } from "@/features/settings/screens/appearance-settings-screen";

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceSettingsScreen,
});
