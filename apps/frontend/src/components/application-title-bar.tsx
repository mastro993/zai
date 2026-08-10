import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  NATIVE_CHROME_LEADING_INSET,
  WEB_CHROME_LEADING_INSET,
  WindowDragRegion,
} from "@/components/window-drag-region";
import { useSidebar } from "@/components/ui/sidebar";
import { AlertsBell } from "@/features/alerts/components/alerts-bell";
import { useScreenBreadcrumbs } from "@/hooks/use-screen-breadcrumbs";
import { createWindowChromeAdapter } from "@/lib/window-chrome";
import type { CommandBuildTarget } from "@/commands/build-target";

type TitleBarActionsTarget = HTMLElement | null;

interface TitleBarContextValue {
  actionsTarget: TitleBarActionsTarget;
  setActionsTarget: (target: TitleBarActionsTarget) => void;
}

const titleBarContext = createContext<TitleBarContextValue | null>(null);

interface ApplicationTitleBarProviderProps {
  children: ReactNode;
}

export function ApplicationTitleBarProvider({ children }: ApplicationTitleBarProviderProps) {
  const [actionsTarget, setActionsTarget] = useState<TitleBarActionsTarget>(null);
  const contextValue = useMemo<TitleBarContextValue>(
    () => ({ actionsTarget, setActionsTarget }),
    [actionsTarget],
  );

  return <titleBarContext.Provider value={contextValue}>{children}</titleBarContext.Provider>;
}

interface ApplicationTitleBarActionsProps {
  children?: ReactNode;
}

export function ApplicationTitleBarActions({ children }: ApplicationTitleBarActionsProps) {
  const target = useContext(titleBarContext)?.actionsTarget;

  if (!target || children === undefined || children === null) {
    return null;
  }

  return createPortal(children, target);
}

function ScreenBreadcrumbs() {
  const crumbs = useScreenBreadcrumbs();

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const crumbKey = crumb.href ?? `current:${crumb.label}`;

          return (
            <span key={crumbKey} className="contents">
              <BreadcrumbItem
                className={
                  index < crumbs.length - 1 ? "max-w-40 truncate sm:max-w-none" : undefined
                }
              >
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link to={crumb.href} preload="intent" />}
                    className="truncate"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

interface ApplicationTitleBarProps {
  buildTarget: CommandBuildTarget;
}

export function ApplicationTitleBar({ buildTarget }: ApplicationTitleBarProps) {
  const { isMobile, state } = useSidebar();
  const titleBarContextValue = useContext(titleBarContext);
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasNativeMacWindowChrome =
    buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  // Toggle is fixed to the window. Clear it only when the title bar sits under that
  // zone: mobile sheet, or Tauri offcanvas collapsed (no sidebar column).
  const needsFixedTriggerClearance = isMobile || (buildTarget === "tauri" && state === "collapsed");

  const leadingStyle = {
    paddingLeft: needsFixedTriggerClearance
      ? hasNativeMacWindowChrome
        ? NATIVE_CHROME_LEADING_INSET
        : WEB_CHROME_LEADING_INSET
      : "1.5rem",
  };

  return (
    <header
      data-slot="application-title-bar"
      data-build-target={buildTarget}
      data-sidebar-state={state}
      data-sidebar-collapsed={state === "collapsed"}
      className="relative z-30 flex h-12 shrink-0 items-center border-b border-border bg-background text-foreground"
    >
      <div className="flex min-w-0 flex-1 items-center">
        <div
          data-slot="title-bar-leading"
          className="flex min-w-0 shrink-0 items-center transition-[padding] duration-200 ease-linear"
          style={leadingStyle}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 items-center">
          <div data-slot="title-bar-breadcrumbs" className="min-w-0 shrink-0">
            <ScreenBreadcrumbs />
          </div>
          <WindowDragRegion
            buildTarget={buildTarget}
            data-slot="title-bar-drag-region"
            className="ml-2 min-w-2 flex-1"
          />
        </div>
      </div>
      <div
        data-slot="title-bar-actions"
        className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-6"
      >
        <div
          ref={titleBarContextValue?.setActionsTarget}
          data-slot="title-bar-route-actions"
          className="flex flex-wrap items-center gap-2"
        />
        <AlertsBell />
      </div>
    </header>
  );
}
