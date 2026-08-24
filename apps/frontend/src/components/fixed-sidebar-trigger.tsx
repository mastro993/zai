import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { NavigationHistoryButtons } from "@/components/navigation-history-buttons";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  NATIVE_TOGGLE_LEADING_INSET,
  TRAFFIC_LIGHT_TO_TRIGGER_GAP,
  TRIGGER_TO_HISTORY_GAP,
} from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

/**
 * Hosts window-chrome controls when the sidebar header cannot:
 * mobile sheet, Tauri offcanvas collapsed, or desktop overlay chrome
 * (toggle after traffic lights, history right-aligned when expanded).
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

  const paddingLeft = hasDesktopWindowChrome
    ? NATIVE_TOGGLE_LEADING_INSET
    : TRAFFIC_LIGHT_TO_TRIGGER_GAP;
  const spanSidebarChrome = hasDesktopWindowChrome && state === "expanded";

  return (
    <div
      data-slot="fixed-sidebar-trigger"
      className={cn(
        "pointer-events-none fixed top-0 left-0 z-40 flex h-12 items-center",
        spanSidebarChrome && "w-(--sidebar-width)",
      )}
      style={{
        paddingLeft,
        paddingRight: spanSidebarChrome ? TRAFFIC_LIGHT_TO_TRIGGER_GAP : undefined,
        gap: spanSidebarChrome ? undefined : TRIGGER_TO_HISTORY_GAP,
      }}
    >
      <div className="pointer-events-auto flex size-8 items-center justify-center">
        <SidebarTrigger />
      </div>
      {buildTarget === "tauri" ? (
        <div
          data-slot="window-chrome-history"
          className={cn("pointer-events-auto", spanSidebarChrome && "ml-auto")}
        >
          <NavigationHistoryButtons />
        </div>
      ) : null}
    </div>
  );
}
