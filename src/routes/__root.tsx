import { SidebarProvider } from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/ToastContainer";
import { migrateToLatest } from "@/lib/database/migrate";
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
    return <div>Loading...</div>;
  }

  return (
    <div className="flex min-h-screen bg-base-100  text-base-content">
      <SidebarProvider>
        <Outlet />
      </SidebarProvider>
      <TanStackRouterDevtools position="bottom-right" />
      <ToastContainer />
    </div>
  );
}
