import { Sidebar } from "@/components/layout/Sidebar";
import { ToastContainer } from "@/components/ToastContainer";
import { migrateToLatest } from "@/lib/database/migrate";
import { cn } from "@/utils/style";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { useEffect, useState } from "react";

const MainContent = () => {
  return (
    <main
      className={cn("flex-1 transition-all duration-300", "ml-64 max-lg:ml-16")}
    >
      <Outlet />
    </main>
  );
};

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
    <div className="flex min-h-screen bg-base-100">
      <Sidebar />
      <MainContent />
      <TanStackRouterDevtools position="bottom-right" />
      <ToastContainer />
    </div>
  );
}
