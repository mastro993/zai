import { useMemo, type PointerEvent, type ReactNode } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { WindowDragRegion } from "@/components/window-drag-region";
import { createWindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

const stopWindowDrag = (event: PointerEvent<HTMLButtonElement>) => {
  event.stopPropagation();
};

interface WindowControlButtonProps {
  label: string;
  tone: "close" | "minimize" | "maximize";
  glyph: string;
  onClick: () => void;
}

function WindowControlButton({ label, tone, glyph, onClick }: WindowControlButtonProps) {
  return (
    <button
      type="button"
      data-slot="window-control"
      data-control={tone}
      aria-label={label}
      className={cn(
        "flex size-3 items-center justify-center rounded-full text-[9px] leading-none font-bold [corner-shape:round]",
        "text-transparent hover:text-current focus-visible:text-current focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        tone === "close" && "bg-[#ff5f57] text-[#4d0000]",
        tone === "minimize" && "bg-[#febc2e] text-[#5a3b00]",
        tone === "maximize" && "bg-[#28c840] text-[#0b3d12]",
      )}
      onPointerDown={stopWindowDrag}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
}

interface WindowControlsProps {
  buildTarget: CommandBuildTarget;
}

/** Linux client-side traffic lights. macOS keeps native buttons. */
export function WindowControls({ buildTarget }: WindowControlsProps) {
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);

  if (buildTarget !== "tauri" || !windowChrome.usesCustomWindowControls) {
    return null;
  }

  return (
    <div
      data-slot="window-controls"
      className="pointer-events-none fixed top-0 left-0 z-50 flex h-12 items-center"
      style={{ paddingLeft: "16px" }}
    >
      <div className="pointer-events-auto flex items-center gap-2">
        <WindowControlButton label="Close" tone="close" glyph="×" onClick={windowChrome.close} />
        <WindowControlButton
          label="Minimize"
          tone="minimize"
          glyph="−"
          onClick={windowChrome.minimize}
        />
        <WindowControlButton
          label="Maximize"
          tone="maximize"
          glyph="+"
          onClick={windowChrome.toggleMaximize}
        />
      </div>
    </div>
  );
}

interface PreWorkspaceWindowChromeProps {
  buildTarget: CommandBuildTarget;
  children: ReactNode;
}

/**
 * Linux setup/splash screens have no application title bar, so they need a
 * dedicated 48px drag strip. macOS still has native traffic lights.
 */
export function PreWorkspaceWindowChrome({ buildTarget, children }: PreWorkspaceWindowChromeProps) {
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);

  if (!windowChrome.usesCustomWindowControls) {
    return children;
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <div data-slot="pre-workspace-window-chrome" className="relative h-12 shrink-0">
        <WindowDragRegion
          buildTarget={buildTarget}
          className="absolute inset-0"
          reserveTrafficLightInset
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
