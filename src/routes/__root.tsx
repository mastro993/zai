import { ModalProvider } from "@/components/Modal/ModalContext";
import { SidebarProvider } from "@/components/Sidebar/Sidebar";
import { migrateToLatest } from "@/lib/database/migrate";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    migrateToLatest()
      .then(() => setIsLoading(false))
      .catch((error) => {
        console.error(error);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-xl text-primary"></span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base-100 text-base-content  select-none">
      <ModalProvider>
        <SidebarProvider>
          <Outlet />
        </SidebarProvider>
      </ModalProvider>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      <Toaster richColors />
    </div>
  );
}
