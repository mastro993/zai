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
import { WindowDragRegion } from "@/components/window-drag-region";
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
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/toaster/toaster";
import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
import { navigationItems, settingsItem } from "@/lib/navigation";
import {
  clearSidebarStateCookie,
  readSidebarOpen,
  writeSidebarOpen,
} from "@/lib/sidebar-preference";

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

function AppSidebar({ buildTarget: sidebarBuildTarget }: AppSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <Sidebar collapsible={sidebarBuildTarget === "tauri" ? "offcanvas" : "icon"}>
      {sidebarBuildTarget === "tauri" ? (
        <div data-slot="sidebar-traffic-light-spacer" className="flex h-12 shrink-0 items-stretch">
          {/* Same height as content title bar; drag strip sits past traffic lights. */}
          <WindowDragRegion
            buildTarget={sidebarBuildTarget}
            data-slot="sidebar-drag-region"
            reserveTrafficLightInset
            className="min-w-0 flex-1"
          />
        </div>
      ) : (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="group-data-[collapsible=icon]:justify-center"
                render={<Link to="/dashboard" />}
              >
                <span className="flex size-4 shrink-0 items-center justify-center text-lg font-semibold text-primary">
                  財
                </span>
                <span className="text-lg font-semibold text-primary group-data-[collapsible=icon]:hidden">
                  Zai
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
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
