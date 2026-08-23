import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useState } from "react";

import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { FixedSidebarTrigger } from "@/components/fixed-sidebar-trigger";
import { PreWorkspaceWindowChrome, WindowControls } from "@/components/window-controls";
import { AlertsControllerProvider } from "@/features/alerts/hooks/use-alerts-controller";
import {
  CurrencyBootstrapProvider,
  useCurrencyBootstrap,
} from "@/features/currency/hooks/use-currency-bootstrap";
import { InitialCurrencySetupScreen } from "@/features/currency/screens/initial-currency-setup-screen";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/toaster/toaster";
import { WebBackendGate } from "@/components/web-backend-gate";
import { WebBackendPlaceholder } from "@/components/web-backend-splash";
import { parseCommandBuildTarget, type CommandBuildTarget } from "@/commands/build-target";
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
