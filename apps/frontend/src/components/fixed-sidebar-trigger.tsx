import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { NavigationHistoryButtons } from "@/components/navigation-history-buttons";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { resolveOverlayChrome, TRIGGER_TO_HISTORY_GAP } from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

export function FixedSidebarTrigger({ buildTarget }: FixedSidebarTriggerProps) {
  const { isMobile, state } = useSidebar();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const overlay = resolveOverlayChrome({
    buildTarget,
    state,
    isMobile,
    hasDesktopWindowChrome,
  });

  if (!overlay.showFixedTrigger) {
    return null;
  }

  return (
    <div
      data-slot="fixed-sidebar-trigger"
      className="pointer-events-none fixed top-0 left-0 z-40 flex h-12 items-center"
      style={{
        paddingLeft: overlay.triggerPaddingLeft,
        gap: TRIGGER_TO_HISTORY_GAP,
      }}
    >
      <div className="pointer-events-auto flex size-8 items-center justify-center">
        <SidebarTrigger className="text-muted-foreground/70" />
      </div>
      {overlay.showHistory ? (
        <div data-slot="window-chrome-history" className="pointer-events-auto">
          <NavigationHistoryButtons />
        </div>
      ) : null}
    </div>
  );
}
