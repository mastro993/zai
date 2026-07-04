import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <main className="flex min-h-svh p-6">
      <section className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-medium">About</h1>
        <p className="text-muted-foreground">
          Blank TanStack Router starter merged into the Zai frontend.
        </p>
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          Back home
        </Link>
      </section>
    </main>
  );
}
