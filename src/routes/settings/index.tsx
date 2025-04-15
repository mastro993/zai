import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Link to="/settings/playgrounds">Playgrounds</Link>
      <Outlet />
    </div>
  );
}
