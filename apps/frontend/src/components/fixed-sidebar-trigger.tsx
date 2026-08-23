import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { NATIVE_TOGGLE_LEADING_INSET } from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

/**
 * Hosts the sidebar toggle when the sidebar header cannot:
 * mobile sheet, Tauri offcanvas collapsed, or desktop overlay chrome
 * (toggle sits after the traffic lights, not beside the logo).
 */
export function FixedSidebarTrigger({ buildTarget }: FixedSidebarTriggerProps) {
  const { isMobile, state } = useSidebar();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;

  const showFixedTrigger =
    isMobile || (buildTarget === "tauri" && state === "collapsed") || hasDesktopWindowChrome;
  if (!showFixedTrigger) {
    return null;
  }

  const paddingLeft = hasDesktopWindowChrome ? NATIVE_TOGGLE_LEADING_INSET : "0.5rem";

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
