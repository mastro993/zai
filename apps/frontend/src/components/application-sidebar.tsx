import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft01Icon,
  BookOpen01Icon,
  Megaphone01Icon,
  Moon02Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";

import type { CommandBuildTarget } from "@/commands/build-target";
import { WindowDragRegion } from "@/components/window-drag-region";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SidebarBrandMark } from "@/components/sidebar-brand-mark";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { SettingsSearchStub } from "@/features/settings/components/settings-search-stub";
import { useOpenSettings } from "@/features/settings/hooks/use-open-settings";
import { navigationItems, settingsItem } from "@/lib/navigation";
import { useWorkspaceChrome } from "@/lib/workspace-chrome";
import { applyStatusBarTheme, nextStatusBarTheme } from "@/lib/theme-toggle";
import { cn } from "@/lib/utils";
import { createWindowChromeAdapter } from "@/lib/window-chrome";

interface ApplicationSidebarProps {
  buildTarget: CommandBuildTarget;
}

export function AppSidebarTrigger({ className }: { className?: string }) {
  const { isMobile, openMobile, state } = useSidebar();
  const expanded = isMobile ? openMobile : state === "expanded";

  return (
    <SidebarTrigger
      className={cn(
        "text-muted-foreground/70 hover:bg-sidebar-accent hover:text-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground/70 aria-expanded:hover:bg-sidebar-accent aria-expanded:hover:text-foreground",
        className,
      )}
      aria-expanded={expanded}
      aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
    />
  );
}

function AppNav({ pathname }: { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <nav aria-label="App">
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
                    render={hasSubItems ? <div /> : <Link to={item.to} preload="intent" />}
                    tooltip={hasSubItems ? undefined : item.title}
                    className={hasSubItems ? "pointer-events-none" : undefined}
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
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const sidebarFooterIconClassName =
  "shrink-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";

function SidebarFooterIconButton({ label, icon }: { label: string; icon: typeof BookOpen01Icon }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={sidebarFooterIconClassName}
            aria-label={label}
          />
        }
      >
        <HugeiconsIcon icon={icon} strokeWidth={2} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("ml-auto", sidebarFooterIconClassName)}
            disabled={!mounted}
            aria-label={label}
            onClick={() => {
              const resolved = resolvedTheme === "dark" ? "dark" : "light";
              const system = systemTheme === "dark" ? "dark" : "light";
              applyStatusBarTheme(nextStatusBarTheme(resolved, system), setTheme);
            }}
          />
        }
      >
        <HugeiconsIcon icon={isDark ? Moon02Icon : Sun01Icon} strokeWidth={2} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WebSidebarChrome({ itemPad }: { itemPad: string }) {
  return (
    <div
      data-slot="sidebar-chrome-header"
      className="relative flex h-12 w-full items-center justify-between"
      style={{
        paddingInline: itemPad,
      }}
    >
      <SidebarBrandMark />
      <div className="relative z-10 flex size-8 shrink-0 items-center justify-center">
        <AppSidebarTrigger />
      </div>
    </div>
  );
}

export function ApplicationSidebar({ buildTarget }: ApplicationSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const chrome = useWorkspaceChrome();
  const openSettings = useOpenSettings();
  const windowChrome = useMemo(() => createWindowChromeAdapter(buildTarget), [buildTarget]);
  const hasDesktopWindowChrome = buildTarget === "tauri" && windowChrome.supportsNativeWindowChrome;
  const itemPad = "0.5rem";

  return (
    <Sidebar collapsible="offcanvas">
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
        {chrome.kind === "settings" ? (
          <SettingsSearchStub />
        ) : hasDesktopWindowChrome ? (
          <SidebarBrandMark />
        ) : (
          <WebSidebarChrome itemPad={itemPad} />
        )}
      </SidebarHeader>
      <SidebarContent>
        {chrome.kind === "settings" ? (
          <SettingsNav pathname={pathname} />
        ) : (
          <AppNav pathname={pathname} />
        )}
      </SidebarContent>
      <SidebarFooter className="shrink-0">
        {chrome.kind === "settings" ? (
          <SidebarMenuButton tooltip="Back" render={<Link to={chrome.returnTo} />}>
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            <span>Back</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton tooltip={settingsItem.title} onClick={() => openSettings()}>
            <HugeiconsIcon icon={settingsItem.icon} strokeWidth={2} />
            <span>{settingsItem.title}</span>
          </SidebarMenuButton>
        )}
        <SidebarSeparator className="mx-0" />
        <TooltipProvider>
          <div className="flex w-full items-center">
            <SidebarFooterIconButton label="Contribute" icon={Megaphone01Icon} />
            <SidebarFooterIconButton label="Documentation" icon={BookOpen01Icon} />
            <ThemeToggle />
          </div>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
