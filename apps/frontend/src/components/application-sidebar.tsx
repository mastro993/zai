import { useRef } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import type { CommandBuildTarget } from "@/commands/build-target";
import { NATIVE_BRAND_LEADING_INSET, WindowDragRegion } from "@/components/window-drag-region";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
import { isSettingsPath, navigationItems, settingsItem, settingsSections } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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
      {/* Optical nudge: text-lg metrics sit slightly high in the 48px strip. */}
      <span className="flex translate-y-[0.5px] items-center gap-0 leading-none">
        {/* size-8 matches icon menu buttons in the rail. */}
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
        className="pointer-events-none absolute inset-0 flex translate-y-[0.5px] items-center justify-center text-lg leading-none font-semibold text-primary transition-[opacity,transform] duration-200 ease-out group-hover/collapsed-chrome:scale-95 group-hover/collapsed-chrome:opacity-0 group-focus-within/collapsed-chrome:scale-95 group-focus-within/collapsed-chrome:opacity-0 motion-reduce:transition-none"
      >
        財
      </span>
      <div className="absolute inset-0 flex scale-95 items-center justify-center opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover/collapsed-chrome:scale-100 group-hover/collapsed-chrome:opacity-100 group-focus-within/collapsed-chrome:scale-100 group-focus-within/collapsed-chrome:opacity-100 motion-reduce:transition-none pointer-events-none group-hover/collapsed-chrome:pointer-events-auto group-focus-within/collapsed-chrome:pointer-events-auto">
        <SidebarTrigger />
      </div>
    </div>
  );
}

function AppNav({ pathname }: { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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

function SettingsNav({ pathname }: { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Settings</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {settingsSections.map((section) => (
            <SidebarMenuItem key={section.to}>
              <SidebarMenuButton
                isActive={pathname === section.to}
                render={<Link to={section.to} preload="intent" />}
                tooltip={section.title}
              >
                <HugeiconsIcon icon={section.icon} strokeWidth={2} />
                <span>{section.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SettingsBackButton({ href }: { href: string }) {
  const router = useRouter();

  return (
    <SidebarMenuButton
      tooltip="Back"
      onClick={() => {
        router.history.push(href);
      }}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      <span>Back</span>
    </SidebarMenuButton>
  );
}

function useAppReturnHref(pathname: string): string {
  const returnHrefRef = useRef("/dashboard");

  if (!isSettingsPath(pathname)) {
    returnHrefRef.current = pathname.length > 0 ? pathname : "/dashboard";
  }

  return returnHrefRef.current;
}

export function ApplicationSidebar({ buildTarget }: ApplicationSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { state: sidebarState } = useSidebar();
  const isExpanded = sidebarState === "expanded";
  const isSettings = isSettingsPath(pathname);
  const returnHref = useAppReturnHref(pathname);
  // Match SidebarGroup `p-2` (0.5rem) so chrome lines up with nav rows.
  const itemPad = "0.5rem";
  const chromePaddingLeft = buildTarget === "tauri" ? NATIVE_BRAND_LEADING_INSET : itemPad;

  const chromeHeader = (
    <div
      data-slot="sidebar-chrome-header"
      className={cn(
        "relative flex h-12 w-full shrink-0 items-center",
        isExpanded ? "justify-between" : "justify-center",
      )}
      style={{
        paddingLeft: isExpanded ? chromePaddingLeft : itemPad,
        paddingRight: itemPad,
      }}
    >
      {buildTarget === "tauri" ? (
        <WindowDragRegion
          buildTarget={buildTarget}
          data-slot="sidebar-drag-region"
          reserveTrafficLightInset
          className="absolute inset-0"
        />
      ) : null}
      {isExpanded ? (
        <>
          {/* Brand left, toggle right — spread across sidebar width. */}
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

  return (
    <Sidebar
      collapsible={buildTarget === "tauri" ? "offcanvas" : "icon"}
      data-mode={isSettings ? "settings" : "app"}
    >
      {buildTarget === "tauri" ? (
        chromeHeader
      ) : (
        <SidebarHeader className="h-12 shrink-0 gap-0 p-0">{chromeHeader}</SidebarHeader>
      )}
      <SidebarContent>
        {isSettings ? <SettingsNav pathname={pathname} /> : <AppNav pathname={pathname} />}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {isSettings ? (
              <SettingsBackButton href={returnHref} />
            ) : (
              <SidebarMenuButton
                isActive={false}
                render={<Link to={settingsItem.to} preload="intent" />}
                tooltip={settingsItem.title}
              >
                <HugeiconsIcon icon={settingsItem.icon} strokeWidth={2} />
                <span>{settingsItem.title}</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
