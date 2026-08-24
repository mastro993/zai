import { useContext } from "react";

import { cn } from "@/lib/utils";

import { AlertsControllerContext } from "../hooks/alerts-controller-context";

interface UnreadAlertsBadgeProps {
  className?: string;
}

export function UnreadAlertsBadge({ className }: UnreadAlertsBadgeProps) {
  const controller = useContext(AlertsControllerContext);
  if (!controller || controller.unreadCount <= 0) {
    return null;
  }

  return (
    <span
      data-slot="unread-alerts-badge"
      className={cn(
        "pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full bg-primary",
        className,
      )}
      aria-hidden
    />
  );
}
