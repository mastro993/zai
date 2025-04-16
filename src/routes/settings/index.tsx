import { useBankConnectionStore } from "@/features/bank-connection/store";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { firstName, setName } = useBankConnectionStore();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Link to="/settings/playgrounds">Playgrounds</Link>
      <p>{firstName}</p>
      <button onClick={() => setName("Culon")}>Set Name</button>
      <Outlet />
    </div>
  );
}
