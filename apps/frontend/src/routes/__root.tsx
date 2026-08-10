import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Result } from "@praha/byethrow";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";

import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { FixedSidebarTrigger } from "@/components/fixed-sidebar-trigger";
import { NATIVE_BRAND_LEADING_INSET, WindowDragRegion } from "@/components/window-drag-region";
import { AlertsControllerProvider } from "@/features/alerts/hooks/use-alerts-controller";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/toaster/toaster";
import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { navigationItems, settingsItem } from "@/lib/navigation";
import {
  clearSidebarStateCookie,
  readSidebarOpen,
  writeSidebarOpen,
} from "@/lib/sidebar-preference";
import { cn } from "@/lib/utils";

export const Route = createRootRoute({
  component: AppLayout,
});

const buildTargetResult = parseCommandBuildTarget(import.meta.env.VITE_ZAI_BUILD_TARGET);

interface ApplicationBuildTargetErrorProps {
  message: string;
}

function ApplicationBuildTargetError({ message }: ApplicationBuildTargetErrorProps) {
  return (
    <main className="grid h-svh place-items-center bg-background p-6 text-foreground">
      <p role="alert">Zai could not start: {message}</p>
    </main>
  );
}

export function AppLayout() {
  if (Result.isFailure(buildTargetResult)) {
    return <ApplicationBuildTargetError message={buildTargetResult.error.message} />;
  }

  return <ApplicationShell buildTarget={buildTargetResult.value} />;
}

interface ApplicationShellProps {
  buildTarget: CommandBuildTarget;
}

function ApplicationShell({ buildTarget }: ApplicationShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);

  useEffect(() => {
    clearSidebarStateCookie();
  }, [sidebarOpen]);

  const handleSidebarOpenChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    writeSidebarOpen(open);
  }, []);

  return (
    <AlertsControllerProvider>
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={handleSidebarOpenChange}
        className="h-svh overflow-hidden"
      >
        <ApplicationTitleBarProvider>
          <FixedSidebarTrigger buildTarget={buildTarget} />
          <AppSidebar buildTarget={buildTarget} />
          <SidebarInset className="min-h-0 overflow-hidden">
            <ApplicationTitleBar buildTarget={buildTarget} />
            <Outlet />
          </SidebarInset>
          <Toaster />
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </ApplicationTitleBarProvider>
      </SidebarProvider>
    </AlertsControllerProvider>
  );
}

interface AppSidebarProps {
  buildTarget: CommandBuildTarget;
}

function SidebarBrandMark({
  wordmark = true,
  className,
}: {
  /** When false, only the 財 kanji is shown (collapsed icon rail). */
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="sidebar-brand"
      data-wordmark={wordmark ? "true" : "false"}
      aria-hidden
      className={cn(
        "pointer-events-none relative z-10 flex min-w-0 select-none items-center gap-1.5",
        className,
      )}
    >
      {/* Optical nudge: text-lg metrics sit slightly high in the 48px strip. */}
      <span className="flex translate-y-[0.5px] items-center gap-1.5 leading-none">
        {/* size-8 matches icon menu buttons in the rail. */}
        <span className="flex size-8 shrink-0 items-center justify-center text-lg leading-none font-semibold text-primary">
          財
        </span>
        {wordmark ? (
          <span className="truncate text-lg leading-none font-semibold text-primary">Zai</span>
        ) : null}
      </span>
    </div>
  );
}

function AppSidebar({ buildTarget: sidebarBuildTarget }: AppSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { state: sidebarState } = useSidebar();
  const isExpanded = sidebarState === "expanded";
  // Match SidebarGroup `p-2` (0.5rem) so chrome lines up with nav rows.
  const itemPad = "0.5rem";
  const chromePaddingLeft = sidebarBuildTarget === "tauri" ? NATIVE_BRAND_LEADING_INSET : itemPad;

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
      {sidebarBuildTarget === "tauri" ? (
        <WindowDragRegion
          buildTarget={sidebarBuildTarget}
          data-slot="sidebar-drag-region"
          reserveTrafficLightInset
          className="absolute inset-0"
        />
      ) : null}
      {isExpanded ? (
        <>
          {/* Brand left, toggle right — spread across sidebar width. */}
          <SidebarBrandMark wordmark />
          <div className="relative z-10 flex size-8 shrink-0 items-center justify-center">
            <SidebarTrigger />
          </div>
        </>
      ) : (
        // Collapsed icon rail: kanji only, centered with nav icons.
        <SidebarBrandMark wordmark={false} />
      )}
    </div>
  );

  return (
    <Sidebar collapsible={sidebarBuildTarget === "tauri" ? "offcanvas" : "icon"}>
      {sidebarBuildTarget === "tauri" ? (
        chromeHeader
      ) : (
        <SidebarHeader className="h-12 shrink-0 gap-0 p-0">{chromeHeader}</SidebarHeader>
      )}
      <SidebarContent>
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname === settingsItem.to}
              render={<Link to={settingsItem.to} preload="intent" />}
              tooltip={settingsItem.title}
            >
              <HugeiconsIcon icon={settingsItem.icon} strokeWidth={2} />
              <span>{settingsItem.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
