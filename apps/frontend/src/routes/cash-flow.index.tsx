import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cash-flow/")({
  beforeLoad: () => {
    throw redirect({ to: "/cash-flow/transactions" });
  },
});
