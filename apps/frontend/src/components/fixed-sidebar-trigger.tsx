import { useMemo } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { AppSidebarTrigger } from "@/components/application-sidebar";
import { NavigationHistoryButtons } from "@/components/navigation-history-buttons";
import { useSidebar } from "@/components/ui/sidebar";
import { resolveOverlayChrome, TRIGGER_TO_HISTORY_GAP } from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";
import { useWorkspaceChrome } from "@/lib/workspace-chrome";

interface FixedSidebarTriggerProps {
  buildTarget: CommandBuildTarget;
}

export function FixedSidebarTrigger({ buildTarget }: FixedSidebarTriggerProps) {
  const { isMobile, state } = useSidebar();
  const chrome = useWorkspaceChrome();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const overlay = resolveOverlayChrome({
    buildTarget,
    state: chrome.kind === "settings" ? "expanded" : state,
    isMobile,
    hasDesktopWindowChrome,
    hideSidebarToggle: chrome.kind === "settings",
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
      {overlay.showToggle ? (
        <div className="pointer-events-auto flex size-8 items-center justify-center">
          <AppSidebarTrigger />
        </div>
      ) : null}
      {overlay.showHistory ? (
        <div data-slot="window-chrome-history" className="pointer-events-auto">
          <NavigationHistoryButtons />
        </div>
      ) : null}
    </div>
  );
}
