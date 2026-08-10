import {
  createContext,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
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
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AlertsBell } from "@/features/alerts/components/alerts-bell";
import { useScreenBreadcrumbs } from "@/hooks/use-screen-breadcrumbs";
import { cn } from "@/lib/utils";
import { createWindowChromeAdapter, type WindowChromeAdapter } from "@/lib/window-chrome";
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

const isPrimaryEmptyRegionPointer = (
  event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
) => event.button === 0 && event.currentTarget === event.target;

const titleBarNativeLeadingWidth = "76px";
const titleBarToggleWidth = "28px";

interface ApplicationTitleBarProps {
  buildTarget: CommandBuildTarget;
}

export function ApplicationTitleBar({ buildTarget }: ApplicationTitleBarProps) {
  const { isMobile, state } = useSidebar();
  const titleBarContextValue = useContext(titleBarContext);
  const windowChrome = useMemo<WindowChromeAdapter>(
    () => createWindowChromeAdapter(buildTarget),
    [buildTarget],
  );
  const hasNativeMacWindowChrome =
    buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const isExpandedDesktop = !isMobile && state === "expanded";

  const leadingStyle = hasNativeMacWindowChrome
    ? {
        width: isExpandedDesktop
          ? "var(--sidebar-width)"
          : `calc(${titleBarNativeLeadingWidth} + ${titleBarToggleWidth})`,
        paddingLeft: titleBarNativeLeadingWidth,
      }
    : isMobile
      ? { paddingLeft: "0.5rem" }
      : {
          width: state === "expanded" ? "var(--sidebar-width)" : "var(--sidebar-width-icon)",
          paddingLeft: "0.5rem",
        };

  const startDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasNativeMacWindowChrome || !isPrimaryEmptyRegionPointer(event)) {
      return;
    }

    event.preventDefault();
    windowChrome.startDragging();
  };

  const toggleMaximize = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasNativeMacWindowChrome || !isPrimaryEmptyRegionPointer(event)) {
      return;
    }

    event.preventDefault();
    windowChrome.toggleMaximize();
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
          className="flex min-w-0 shrink-0 items-center transition-[padding,width] duration-200 ease-linear"
          style={leadingStyle}
        >
          <SidebarTrigger />
          {hasNativeMacWindowChrome && isExpandedDesktop ? (
            <div
              data-slot="title-bar-drag-region"
              className="h-12 min-w-2 flex-1 cursor-default transition-[width] duration-200 ease-linear"
              onPointerDown={startDragging}
              onDoubleClick={toggleMaximize}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 items-center">
          <div
            data-slot="title-bar-breadcrumbs"
            className={cn(
              "min-w-0",
              hasNativeMacWindowChrome && !isExpandedDesktop ? "shrink-0" : "flex-1",
            )}
          >
            <ScreenBreadcrumbs />
          </div>
          {hasNativeMacWindowChrome && !isExpandedDesktop ? (
            <div
              data-slot="title-bar-drag-region"
              className="ml-2 h-12 min-w-2 flex-1 cursor-default transition-[width] duration-200 ease-linear"
              onPointerDown={startDragging}
              onDoubleClick={toggleMaximize}
            />
          ) : null}
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
