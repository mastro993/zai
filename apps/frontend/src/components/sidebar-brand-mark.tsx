import { cn } from "@/lib/utils";

interface SidebarBrandMarkProps {
  className?: string;
}

export function SidebarBrandMark({ className }: SidebarBrandMarkProps) {
  return (
    <div
      data-slot="sidebar-brand"
      data-wordmark="true"
      aria-hidden
      className={cn(
        "pointer-events-none relative z-10 flex min-w-0 select-none items-center gap-1.5",
        className,
      )}
    >
      <span className="flex items-center gap-0 leading-none">
        <span className="flex size-8 shrink-0 items-center justify-center text-lg leading-none font-semibold text-primary">
          財
        </span>
        <span className="truncate text-lg leading-none font-semibold text-primary">Zai</span>
      </span>
    </div>
  );
}
