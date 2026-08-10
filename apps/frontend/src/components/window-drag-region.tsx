import { useMemo, type MouseEvent, type PointerEvent } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { createWindowChromeAdapter, type WindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

/** Logical width reserved for macOS traffic lights (close / minimize / zoom). */
export const TRAFFIC_LIGHT_LEADING_WIDTH = "76px";

const isPrimaryEmptyRegionPointer = (
  event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
) => event.button === 0 && event.currentTarget === event.target;

interface WindowDragRegionProps {
  buildTarget: CommandBuildTarget;
  className?: string;
  /** Extra leading space so the strip does not cover traffic lights. */
  reserveTrafficLightInset?: boolean;
  "data-slot"?: string;
}

/**
 * Empty strip that starts a window drag (and double-click maximize) on macOS Tauri.
 * Renders nothing when native window chrome is unavailable.
 */
export function WindowDragRegion({
  buildTarget,
  className,
  reserveTrafficLightInset = false,
  "data-slot": dataSlot = "window-drag-region",
}: WindowDragRegionProps) {
  const windowChrome = useMemo<WindowChromeAdapter>(
    () => createWindowChromeAdapter(buildTarget),
    [buildTarget],
  );

  // Web builds never expose native drag; Tauri + non-mac also no-op via adapter.
  if (buildTarget !== "tauri" || !windowChrome.supportsNativeWindowChrome) {
    return null;
  }

  const startDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPrimaryEmptyRegionPointer(event)) {
      return;
    }

    event.preventDefault();
    windowChrome.startDragging();
  };

  const toggleMaximize = (event: MouseEvent<HTMLDivElement>) => {
    if (!isPrimaryEmptyRegionPointer(event)) {
      return;
    }

    event.preventDefault();
    windowChrome.toggleMaximize();
  };

  return (
    <div
      data-slot={dataSlot}
      className={cn("h-12 min-w-0 cursor-default", className)}
      style={reserveTrafficLightInset ? { paddingLeft: TRAFFIC_LIGHT_LEADING_WIDTH } : undefined}
      onPointerDown={startDragging}
      onDoubleClick={toggleMaximize}
    />
  );
}
