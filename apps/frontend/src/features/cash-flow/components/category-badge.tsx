import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getCategoryBadgeColors } from "../lib/category-color";

function CategoryBadge({
  color,
  className,
  truncate = true,
  children,
}: {
  color: string;
  className?: string;
  truncate?: boolean;
  children: ReactNode;
}) {
  const { background, foreground, border } = getCategoryBadgeColors(color);
  return (
    <Badge
      className={cn("max-w-full", !truncate && "h-auto whitespace-normal", className)}
      style={{ backgroundColor: background, color: foreground, borderColor: border }}
    >
      <span className={truncate ? "truncate" : "text-left wrap-break-word"}>{children}</span>
    </Badge>
  );
}

export { CategoryBadge };
