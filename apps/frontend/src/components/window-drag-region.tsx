import { useMemo, type MouseEvent, type PointerEvent } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { createWindowChromeAdapter, type WindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

/** Logical width reserved for macOS traffic lights (close / minimize / zoom). */
export const TRAFFIC_LIGHT_LEADING_WIDTH = "76px";
/** Slot for the sidebar trigger (`size="icon-sm"` ≈ 32px). */
export const SIDEBAR_TRIGGER_SLOT_WIDTH = "2rem";
/** Gap between traffic lights and the first chrome control (brand or toggle). */
export const TRAFFIC_LIGHT_TO_TRIGGER_GAP = "0.5rem";
/** Gap between logo and sidebar toggle when expanded. */
export const BRAND_TO_TRIGGER_GAP = "0.5rem";
/** Gap used when the title bar must clear lights + toggle (mobile / offcanvas). */
export const TRIGGER_TO_CONTENT_GAP = "0.5rem";

/** Brand starts after traffic lights (toggle sits after brand when expanded). */
export const NATIVE_BRAND_LEADING_INSET = `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP})`;

/** Brand starts after small pad on web (no traffic lights). */
export const WEB_BRAND_LEADING_INSET = "0.5rem";

/** Title-bar inset when fixed toggle is after traffic lights (native mac). */
export const NATIVE_CHROME_LEADING_INSET = `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP} + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

/** Title-bar inset when fixed toggle is at the left (web / mobile). */
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
