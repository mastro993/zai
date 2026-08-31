import { createFileRoute } from "@tanstack/react-router";

import { DiagnosticsSettingsScreen } from "@/features/settings/screens/diagnostics-settings-screen";

export const Route = createFileRoute("/settings/diagnostics")({
  component: DiagnosticsSettingsScreen,
});
