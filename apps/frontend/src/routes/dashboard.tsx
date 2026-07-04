import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Dashboard</h1>
    </section>
  );
}
