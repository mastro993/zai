import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getCategoryBadgeColors } from "../lib/category-color";

function CategoryBadge({
  hue,
  className,
  truncate = true,
  children,
}: {
  hue: number | null;
  className?: string;
  truncate?: boolean;
  children: ReactNode;
}) {
  const { background, foreground } = getCategoryBadgeColors(hue);
  return (
    <Badge
      className={cn(
        "max-w-full border-0 font-semibold",
        !truncate && "h-auto whitespace-normal",
        className,
      )}
      style={{ backgroundColor: background, color: foreground }}
    >
      <span className={truncate ? "truncate" : "text-left wrap-break-word"}>{children}</span>
    </Badge>
  );
}

export { CategoryBadge };
