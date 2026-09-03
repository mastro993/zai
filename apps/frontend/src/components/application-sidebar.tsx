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
} from "@/components/ui/sidebar";
import { SidebarBrandMark } from "@/components/sidebar-brand-mark";
import { useSettingsReturnHrefValue } from "@/features/settings/hooks/use-settings-return-href";
import { isSettingsPath, navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface ApplicationSidebarProps {
  buildTarget: CommandBuildTarget;
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

function WebSidebarChrome({ itemPad }: { itemPad: string }) {
  return (
    <div
      data-slot="sidebar-chrome-header"
      className="relative flex h-12 w-full items-center justify-between"
      style={{
        paddingLeft: itemPad,
        paddingRight: itemPad,
      }}
    >
      <SidebarBrandMark />
      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center">
        <SidebarTrigger className="text-muted-foreground/70" />
      </div>
    </div>
  );
}

export function ApplicationSidebar({ buildTarget }: ApplicationSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnHref = useSettingsReturnHrefValue();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const navPathname = isSettingsPath(pathname) ? returnHref : pathname;
  const itemPad = "0.5rem";

  return (
    <Sidebar
      collapsible="offcanvas"
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
        {hasDesktopWindowChrome ? <SidebarBrandMark /> : <WebSidebarChrome itemPad={itemPad} />}
      </SidebarHeader>
      <SidebarContent>
        <AppNav pathname={navPathname} />
      </SidebarContent>
    </Sidebar>
  );
}
