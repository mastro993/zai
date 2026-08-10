import { useMemo, type MouseEvent, type PointerEvent } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { createWindowChromeAdapter, type WindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

/** Logical width reserved for macOS traffic lights (close / minimize / zoom). */
export const TRAFFIC_LIGHT_LEADING_WIDTH = "76px";
/** Slot for the fixed sidebar trigger after traffic lights (`size="icon-sm"` ≈ 32px). */
export const SIDEBAR_TRIGGER_SLOT_WIDTH = "2rem";
/** Gap between traffic lights and the sidebar trigger. */
export const TRAFFIC_LIGHT_TO_TRIGGER_GAP = "0.5rem";
/** Gap between sidebar trigger and brand / title content. */
export const TRIGGER_TO_CONTENT_GAP = "0.5rem";

/** Window-left inset through traffic lights + trigger (native mac chrome). */
export const NATIVE_CHROME_LEADING_INSET = `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP} + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

/** Window-left inset through trigger only (web / no traffic lights). */
export const WEB_CHROME_LEADING_INSET = `calc(0.5rem + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

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
