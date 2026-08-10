import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  TRAFFIC_LIGHT_LEADING_WIDTH,
  TRAFFIC_LIGHT_TO_TRIGGER_GAP,
} from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

/**
 * Sidebar toggle pinned to the window top-left (after traffic lights on macOS).
 * Stays put when the sidebar expands or collapses.
 */
export function FixedSidebarTrigger({ buildTarget }: FixedSidebarTriggerProps) {
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasNativeMacWindowChrome =
    buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;

  const paddingLeft = hasNativeMacWindowChrome
    ? `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP})`
    : "0.5rem";

  return (
    <div
      data-slot="fixed-sidebar-trigger"
      className="pointer-events-none fixed top-0 left-0 z-40 flex h-12 items-center"
      style={{ paddingLeft }}
    >
      <div className="pointer-events-auto flex size-8 items-center justify-center">
        <SidebarTrigger />
      </div>
    </div>
  );
}
