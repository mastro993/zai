import { Spinner } from "@/components/ui/spinner";

export function WebBackendPlaceholder() {
  return <div className="h-svh bg-background" />;
}

export function WebBackendSplash() {
  return (
    <main className="grid h-svh place-items-center bg-background text-foreground">
      <div className="flex animate-in fade-in flex-col items-center gap-5 duration-300 motion-reduce:animate-none">
        <div
          aria-label="Zai"
          className="flex size-16 items-center justify-center rounded-[1.25rem] bg-card text-3xl leading-none font-semibold text-primary shadow-sm ring-1 ring-border"
        >
          財
        </div>
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    </main>
  );
}
