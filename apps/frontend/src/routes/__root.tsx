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
import {
  NATIVE_CHROME_LEADING_INSET,
  WEB_CHROME_LEADING_INSET,
  WindowDragRegion,
} from "@/components/window-drag-region";
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

function AppSidebar({ buildTarget: sidebarBuildTarget }: AppSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { state: sidebarState } = useSidebar();
  const showBrand = sidebarState === "expanded";

  return (
    <Sidebar collapsible={sidebarBuildTarget === "tauri" ? "offcanvas" : "icon"}>
      {sidebarBuildTarget === "tauri" ? (
        <div data-slot="sidebar-chrome-header" className="relative flex h-12 shrink-0 items-center">
          {/* Drag under lights + toggle + brand; toggle itself is fixed chrome. */}
          <WindowDragRegion
            buildTarget={sidebarBuildTarget}
            data-slot="sidebar-drag-region"
            reserveTrafficLightInset
            className="absolute inset-0"
          />
          {showBrand ? (
            <Link
              to="/dashboard"
              data-slot="sidebar-brand"
              className="relative z-10 flex h-12 min-w-0 items-center gap-1.5 pr-2 leading-none outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              style={{
                // lights | gap | toggle | gap | 財 Zai
                paddingLeft: NATIVE_CHROME_LEADING_INSET,
              }}
            >
              {/* Optical nudge: text-lg metrics sit slightly high in the 48px strip. */}
              <span className="flex translate-y-[0.5px] items-center gap-1.5">
                <span className="flex shrink-0 items-center justify-center text-lg leading-none font-semibold text-primary">
                  財
                </span>
                <span className="truncate text-lg leading-none font-semibold text-primary">
                  Zai
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      ) : (
        <SidebarHeader>
          {showBrand ? (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="h-12 leading-none"
                  style={{ paddingLeft: WEB_CHROME_LEADING_INSET }}
                  render={<Link to="/dashboard" />}
                >
                  <span className="flex translate-y-[0.5px] items-center gap-1.5">
                    <span className="flex shrink-0 items-center justify-center text-lg leading-none font-semibold text-primary">
                      財
                    </span>
                    <span className="text-lg leading-none font-semibold text-primary">Zai</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : null}
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
