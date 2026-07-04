import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Settings</h1>
    </section>
  );
}
