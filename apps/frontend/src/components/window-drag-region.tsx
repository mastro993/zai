import { useMemo, type MouseEvent, type PointerEvent } from "react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { createWindowChromeAdapter, type WindowChromeAdapter } from "@/lib/window-chrome";
import { cn } from "@/lib/utils";

export const TRAFFIC_LIGHT_LEADING_WIDTH = "76px";
export const SIDEBAR_TRIGGER_SLOT_WIDTH = "2rem";
export const HISTORY_BUTTONS_SLOT_WIDTH = "3.5rem";
export const TRAFFIC_LIGHT_TO_TRIGGER_GAP = "0.5rem";
export const TRIGGER_TO_HISTORY_GAP = "0.25rem";
export const TRIGGER_TO_CONTENT_GAP = TRAFFIC_LIGHT_TO_TRIGGER_GAP;

export const NATIVE_TOGGLE_LEADING_INSET = `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP})`;

export const NATIVE_CHROME_LEADING_INSET = `calc(${TRAFFIC_LIGHT_LEADING_WIDTH} + ${TRAFFIC_LIGHT_TO_TRIGGER_GAP} + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_HISTORY_GAP} + ${HISTORY_BUTTONS_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

export const WEB_CHROME_WITH_HISTORY_LEADING_INSET = `calc(${TRAFFIC_LIGHT_TO_TRIGGER_GAP} + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_HISTORY_GAP} + ${HISTORY_BUTTONS_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

export const WEB_CHROME_LEADING_INSET = `calc(0.5rem + ${SIDEBAR_TRIGGER_SLOT_WIDTH} + ${TRIGGER_TO_CONTENT_GAP})`;

export interface OverlayChrome {
  showFixedTrigger: boolean;
  showHistory: boolean;
  triggerPaddingLeft: string;
  showTitleBarSeparator: boolean;
  titleBarLeadingInset: string;
}

interface OverlayChromeInput {
  buildTarget: CommandBuildTarget;
  state: "expanded" | "collapsed";
  isMobile: boolean;
  hasDesktopWindowChrome: boolean;
}

export function resolveOverlayChrome({
  buildTarget,
  state,
  isMobile,
  hasDesktopWindowChrome,
}: OverlayChromeInput): OverlayChrome {
  const collapsed = state === "collapsed";
  const showFixedTrigger = isMobile || collapsed || hasDesktopWindowChrome;
  const showHistory = buildTarget === "tauri" && showFixedTrigger;
  const needsTitleBarClearance = isMobile || collapsed;

  return {
    showFixedTrigger,
    showHistory,
    triggerPaddingLeft: hasDesktopWindowChrome
      ? NATIVE_TOGGLE_LEADING_INSET
      : TRAFFIC_LIGHT_TO_TRIGGER_GAP,
    showTitleBarSeparator: collapsed && !isMobile,
    titleBarLeadingInset: !needsTitleBarClearance
      ? "1rem"
      : hasDesktopWindowChrome
        ? NATIVE_CHROME_LEADING_INSET
        : showHistory
          ? WEB_CHROME_WITH_HISTORY_LEADING_INSET
          : WEB_CHROME_LEADING_INSET,
  };
}

const isPrimaryEmptyRegionPointer = (
  event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
) => event.button === 0 && event.currentTarget === event.target;

interface WindowDragRegionProps {
  buildTarget: CommandBuildTarget;
  className?: string;
  reserveTrafficLightInset?: boolean;
  "data-slot"?: string;
}

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
