import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getCategoryBadgeColors } from "../lib/category-color";

function CategoryBadge({
  color,
  className,
  children,
}: {
  color: string;
  className?: string;
  children: ReactNode;
}) {
  const { background, foreground } = getCategoryBadgeColors(color);
  return (
    <Badge
      className={cn("max-w-full", className)}
      style={{ backgroundColor: background, color: foreground }}
    >
      <span className="truncate">{children}</span>
    </Badge>
  );
}

export { CategoryBadge };
