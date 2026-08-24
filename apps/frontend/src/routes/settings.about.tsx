import { createFileRoute } from "@tanstack/react-router";

import { AboutSettingsScreen } from "@/features/settings/screens/about-settings-screen";

export const Route = createFileRoute("/settings/about")({
  component: AboutSettingsScreen,
});
