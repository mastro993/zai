import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

const MainContent = () => {
  return (
    <main
      className={cn(
        "flex-1 p-8 transition-all duration-300",
        "ml-64 max-lg:ml-16"
      )}
    >
      <Outlet />
    </main>
  );
};

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen">
      <Sidebar />
      <MainContent />
      <TanStackRouterDevtools />
    </div>
  ),
});
