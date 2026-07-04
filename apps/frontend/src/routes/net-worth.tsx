import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/net-worth")({ component: NetWorthPage });

function NetWorthPage() {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Net Worth</h1>
    </section>
  );
}
