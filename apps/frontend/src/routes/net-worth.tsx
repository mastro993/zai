import { createFileRoute } from "@tanstack/react-router";

import { ScreenBase } from "@/components/screen-base";

export const Route = createFileRoute("/net-worth")({ component: NetWorthPage });

function NetWorthPage() {
  return <ScreenBase />;
}
