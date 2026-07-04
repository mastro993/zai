import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="flex min-h-svh p-6">
      <section className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Zai</h1>
          <p>Personal finance, local-first.</p>
          <div className="mt-2 flex flex-col gap-2">
            <Button>Get started</Button>
            <Button variant="outline" render={<Link to="/about" />}>
              About
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
