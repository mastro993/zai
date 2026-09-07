import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useState } from "react";

import { ApplicationSidebar } from "@/components/application-sidebar";
import {
  ApplicationTitleBar,
  ApplicationTitleBarProvider,
} from "@/components/application-title-bar";
import { FixedSidebarTrigger } from "@/components/fixed-sidebar-trigger";
import { PreWorkspaceWindowChrome, WindowControls } from "@/components/window-controls";
import { AlertsControllerProvider } from "@/features/alerts/hooks/use-alerts-controller";
import {
  CurrencyBootstrapProvider,
  useCurrencyBootstrap,
} from "@/features/currency/hooks/use-currency-bootstrap";
import { InitialCurrencySetupScreen } from "@/features/currency/screens/initial-currency-setup-screen";
import { SettingsReturnHrefProvider } from "@/features/settings/hooks/use-settings-return-href";

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
import {
  sidebarOpenForChrome,
  shouldPersistSidebarOpen,
  useWorkspaceChrome,
} from "@/lib/workspace-chrome";

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
      <SettingsReturnHrefProvider>
        <ApplicationWorkspaceChrome
          buildTarget={buildTarget}
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={handleSidebarOpenChange}
        />
      </SettingsReturnHrefProvider>
    </AlertsControllerProvider>
  );
}

interface ApplicationWorkspaceChromeProps {
  buildTarget: CommandBuildTarget;
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
}

function ApplicationWorkspaceChrome({
  buildTarget,
  sidebarOpen,
  onSidebarOpenChange,
}: ApplicationWorkspaceChromeProps) {
  const chrome = useWorkspaceChrome();
  const persistOpen = shouldPersistSidebarOpen(chrome);

  const handleSidebarOpenChange = useCallback(
    (open: boolean) => {
      if (!persistOpen) {
        clearSidebarStateCookie();
        return;
      }
      onSidebarOpenChange(open);
    },
    [onSidebarOpenChange, persistOpen],
  );

  return (
    <SidebarProvider
      open={sidebarOpenForChrome(chrome, sidebarOpen)}
      onOpenChange={handleSidebarOpenChange}
      className="flex h-svh flex-col overflow-hidden"
    >
      <ApplicationTitleBarProvider>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:inline-flex focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-3 focus:ring-ring/50"
          >
            Skip to content
          </a>
          <FixedSidebarTrigger buildTarget={buildTarget} />
          <ApplicationSidebar buildTarget={buildTarget} />
          <SidebarInset className="min-h-0 overflow-hidden">
            <ApplicationTitleBar buildTarget={buildTarget} />
            <main
              id="main-content"
              tabIndex={-1}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <Outlet />
            </main>
          </SidebarInset>
        </div>
        <Toaster />
        <TanStackDevtools
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </ApplicationTitleBarProvider>
    </SidebarProvider>
  );
}
