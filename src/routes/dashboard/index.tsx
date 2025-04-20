import { ThemeToggle } from "@/components/ThemeToggle";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <ThemeToggle />
    </div>
  );
}
