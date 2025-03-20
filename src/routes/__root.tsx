import { ModalProvider } from "@/components/Modal/ModalContext";
import { SidebarProvider } from "@/components/Sidebar/Sidebar";
import { ToastContainer } from "@/components/ToastContainer";
import { migrateToLatest } from "@/lib/database/migrate";
import { Spinner } from "@radix-ui/themes";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { useEffect, useState } from "react";

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
        <Spinner size="3" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base-100 text-base-content">
      <ModalProvider>
        <SidebarProvider>
          <Outlet />
        </SidebarProvider>
        <ToastContainer />
      </ModalProvider>
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </div>
  );
}
