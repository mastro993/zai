import { Outlet, createFileRoute } from "@tanstack/react-router";

import { SettingsModal } from "@/features/settings/components/settings-modal";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <SettingsModal>
      <Outlet />
    </SettingsModal>
  );
}
