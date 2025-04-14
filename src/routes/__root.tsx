import { SidebarProvider } from "@/components/ui/Sidebar";
import { ModalProvider } from "@/components/widgets/Modal";
import { migrateToLatest } from "@/lib/database/migrate";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
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
    <div className="flex h-screen select-none">
      <ModalProvider>
        <SidebarProvider>
          <Outlet />
        </SidebarProvider>
      </ModalProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools initialIsOpen={false} position="left" />
      <Toaster richColors />
    </div>
  );
}
