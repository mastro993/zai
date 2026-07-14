import { Skeleton } from "@/components/ui/skeleton";

export function AlertsLedgerSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-2 border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
