import type { ReactNode } from "react";

import { ApplicationTitleBarActions } from "@/components/application-title-bar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ScreenBaseProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ScreenBase({ actions, children, className, contentClassName }: ScreenBaseProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <ApplicationTitleBarActions>{actions}</ApplicationTitleBarActions>
      <ScrollArea className="min-h-0 flex-1">
        <div className={cn("flex min-h-full flex-col gap-4 px-4 py-6", contentClassName)}>
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
