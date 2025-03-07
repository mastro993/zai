import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

const MainContent = () => {
  return (
    <main className={cn("flex-1 p-8 transition-all duration-300", "ml-64")}>
      <Outlet />
    </main>
  );
};

export const Route = createRootRoute({
  component: () => (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <MainContent />
        <TanStackRouterDevtools />
      </div>
    </SidebarProvider>
  ),
});
