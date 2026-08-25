import { Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

export function AlertsLedgerSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 px-1.5 pb-2" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <Item key={index} size="xs" className="items-start">
          <ItemMedia variant="icon">
            <Skeleton className="size-6 rounded-md" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="mt-1 h-3 w-full" />
          </ItemContent>
          <ItemActions className="self-start">
            <Skeleton className="size-6 rounded-md" />
          </ItemActions>
        </Item>
      ))}
    </div>
  );
}
