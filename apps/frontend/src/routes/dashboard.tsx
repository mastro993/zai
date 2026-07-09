import { createFileRoute } from "@tanstack/react-router";

import { ScreenBase } from "@/components/screen-base";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  return <ScreenBase />;
}
