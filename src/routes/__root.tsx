import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { migrateToLatest } from "@/lib/database";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const [isLoading, setIsLoading] = useState(true);

  const migrate = useCallback(async () => {
    await migrateToLatest();
    setIsLoading(false);
  }, []);

  useEffect(() => {
    migrate();
  }, [migrate]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-xl text-primary"></span>
      </div>
    );
  }

  return (
    <div className="flex h-screen select-none">
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="@container">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <ReactQueryDevtools
        initialIsOpen={false}
        buttonPosition="bottom-left"
        position="bottom"
      />
      <TanStackRouterDevtools position="bottom-left" />
      <Toaster richColors />
    </div>
  );
}
