import { Sidebar } from "@/components/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  const [isLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <span className="loading loading-spinner loading-xl text-primary"></span>
      </div>
    );
  }

  return (
    <div className="flex h-screen select-none bg-background">
      <SidebarProvider>
        <Sidebar />
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
