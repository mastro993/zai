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
import { PreWorkspaceWindowChrome, WindowControls } from "@/components/window-controls";
import { NATIVE_BRAND_LEADING_INSET, WindowDragRegion } from "@/components/window-drag-region";
import { AlertsControllerProvider } from "@/features/alerts/hooks/use-alerts-controller";
import {
  CurrencyBootstrapProvider,
  useCurrencyBootstrap,
} from "@/features/currency/hooks/use-currency-bootstrap";
import { InitialCurrencySetupScreen } from "@/features/currency/screens/initial-currency-setup-screen";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/toaster/toaster";
import { WebBackendGate } from "@/components/web-backend-gate";
import { WebBackendPlaceholder } from "@/components/web-backend-splash";
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

  return (
    <WebBackendGate enabled={buildTargetResult.value === "web"}>
      <CurrencyBootstrapProvider>
        <WindowControls buildTarget={buildTargetResult.value} />
        <ApplicationShell buildTarget={buildTargetResult.value} />
      </CurrencyBootstrapProvider>
    </WebBackendGate>
  );
}

interface ApplicationShellProps {
  buildTarget: CommandBuildTarget;
}

function ApplicationShell({ buildTarget }: ApplicationShellProps) {
  const { ready, setupComplete } = useCurrencyBootstrap();

  if (!ready) {
    return (
      <PreWorkspaceWindowChrome buildTarget={buildTarget}>
        <WebBackendPlaceholder />
      </PreWorkspaceWindowChrome>
    );
  }

  if (!setupComplete) {
    return (
      <PreWorkspaceWindowChrome buildTarget={buildTarget}>
        <InitialCurrencySetupScreen />
      </PreWorkspaceWindowChrome>
    );
  }

  return <ApplicationWorkspace buildTarget={buildTarget} />;
}

function ApplicationWorkspace({ buildTarget }: ApplicationShellProps) {
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
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Outlet />
            </main>
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
    <Sidebar collapsible={sidebarBuildTarget === "tauri" ? "offcanvas" : "icon"}>
      {sidebarBuildTarget === "tauri" ? (
        chromeHeader
      ) : (
        <SidebarHeader className="h-12 shrink-0 gap-0 p-0">{chromeHeader}</SidebarHeader>
      )}
      <SidebarContent>
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
    </Sidebar>
  );
}
