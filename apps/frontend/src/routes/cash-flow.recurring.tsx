import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/recurring")({
  component: () => <Outlet />,
});
