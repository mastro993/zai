import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  TRAFFIC_LIGHT_LEADING_WIDTH,
  TRAFFIC_LIGHT_TO_TRIGGER_GAP,
} from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

/**
 * Toggle only when the sidebar chrome cannot host it:
 * mobile sheet, or Tauri offcanvas collapsed (no sidebar column).
 * Expanded desktop hosts the toggle after the brand; icon-collapsed shows kanji only.
 */
export function FixedSidebarTrigger({ buildTarget }: FixedSidebarTriggerProps) {
  const { isMobile, state } = useSidebar();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;

  const showFixedTrigger = isMobile || (buildTarget === "tauri" && state === "collapsed");
  if (!showFixedTrigger) {
    return null;
  }

  const paddingLeft = hasDesktopWindowChrome
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
