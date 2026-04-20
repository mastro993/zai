import { Sidebar } from "@/components/navigation";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <div className="flex h-screen select-none bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto @container">
        <Outlet />
      </main>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" position="bottom" />
      <TanStackRouterDevtools position="bottom-left" />
      <Toaster richColors />
    </div>
  );
}
