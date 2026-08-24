import { useMemo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";

import type { CommandBuildTarget } from "@/commands/build-target";
import { WindowDragRegion } from "@/components/window-drag-region";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSettingsReturnHrefValue } from "@/features/settings/hooks/use-settings-return-href";
import { isSettingsPath, navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface ApplicationSidebarProps {
  buildTarget: CommandBuildTarget;
}

function SidebarBrandMark({ className }: { className?: string }) {
  return (
    <div
      data-slot="sidebar-brand"
      data-wordmark="true"
      aria-hidden
      className={cn(
        "pointer-events-none relative z-10 flex min-w-0 select-none items-center gap-1.5",
        className,
      )}
    >
      <span className="flex items-center gap-0 leading-none">
        <span className="flex size-8 shrink-0 items-center justify-center text-lg leading-none font-semibold text-primary">
          財
        </span>
        <span className="truncate text-lg leading-none font-semibold text-primary">Zai</span>
      </span>
    </div>
  );
}

/**
 * Collapsed icon-rail chrome: show 財 by default; hover/focus reveals the toggle
 * with a short cross-fade so the user can expand the sidebar.
 */
function CollapsedSidebarChrome() {
  return (
    <div
      data-slot="sidebar-collapsed-chrome"
      className="group/collapsed-chrome relative z-10 flex size-8 items-center justify-center"
    >
      <span
        data-slot="sidebar-brand"
        data-wordmark="false"
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg leading-none font-semibold text-primary transition-[opacity,transform] duration-200 ease-out group-hover/collapsed-chrome:scale-95 group-hover/collapsed-chrome:opacity-0 group-focus-within/collapsed-chrome:scale-95 group-focus-within/collapsed-chrome:opacity-0 motion-reduce:transition-none"
      >
        財
      </span>
      <div className="pointer-events-none absolute inset-0 flex scale-95 items-center justify-center opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/collapsed-chrome:pointer-events-auto group-hover/collapsed-chrome:scale-100 group-hover/collapsed-chrome:opacity-100 group-focus-within/collapsed-chrome:pointer-events-auto group-focus-within/collapsed-chrome:scale-100 group-focus-within/collapsed-chrome:opacity-100 motion-reduce:transition-none">
        <SidebarTrigger />
      </div>
    </div>
  );
}

function AppNav({ pathname }: { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navigationItems.map((item) => {
            const hasSubItems = "subItems" in item && item.subItems !== undefined;
            const isActive =
              pathname === item.to ||
              (hasSubItems &&
                item.subItems.some(
                  (subItem) => pathname === subItem.to || pathname.startsWith(`${subItem.to}/`),
                ));

            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link to={item.to} preload="intent" />}
                  tooltip={item.title}
                >
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
                {hasSubItems ? (
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.to}>
                        <SidebarMenuSubButton
                          isActive={
                            pathname === subItem.to || pathname.startsWith(`${subItem.to}/`)
                          }
                          render={<Link to={subItem.to} preload="intent" />}
                        >
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function WebSidebarChrome({ isExpanded, itemPad }: { isExpanded: boolean; itemPad: string }) {
  return (
    <div
      data-slot="sidebar-chrome-header"
      className={cn(
        "relative flex h-12 w-full items-center",
        isExpanded ? "justify-between" : "justify-center",
      )}
      style={{
        paddingLeft: itemPad,
        paddingRight: itemPad,
      }}
    >
      {isExpanded ? (
        <>
          <SidebarBrandMark />
          <div className="relative z-10 flex size-8 shrink-0 items-center justify-center">
            <SidebarTrigger />
          </div>
        </>
      ) : (
        <CollapsedSidebarChrome />
      )}
    </div>
  );
}

export function ApplicationSidebar({ buildTarget }: ApplicationSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnHref = useSettingsReturnHrefValue();
  const { state: sidebarState } = useSidebar();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const isExpanded = sidebarState === "expanded";
  const navPathname = isSettingsPath(pathname) ? returnHref : pathname;
  const itemPad = "0.5rem";

  return (
    <Sidebar
      collapsible={buildTarget === "tauri" ? "offcanvas" : "icon"}
      className="top-0 bottom-8 h-auto group-data-[collapsible=offcanvas]:bottom-0 group-data-[collapsible=offcanvas]:h-svh"
    >
      {hasDesktopWindowChrome ? (
        <div data-slot="sidebar-window-chrome" className="relative h-12 w-full shrink-0">
          <WindowDragRegion
            buildTarget={buildTarget}
            data-slot="sidebar-drag-region"
            reserveTrafficLightInset
            className="absolute inset-0"
          />
        </div>
      ) : null}
      <SidebarHeader className={cn("shrink-0 gap-0", hasDesktopWindowChrome ? "px-2 py-1" : "p-0")}>
        {hasDesktopWindowChrome ? (
          <SidebarBrandMark />
        ) : (
          <WebSidebarChrome isExpanded={isExpanded} itemPad={itemPad} />
        )}
      </SidebarHeader>
      <SidebarContent>
        <AppNav pathname={navPathname} />
      </SidebarContent>
    </Sidebar>
  );
}
