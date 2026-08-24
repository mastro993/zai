import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

import { alertsBellLabel } from "../lib/format";
import { useAlertsController } from "../hooks/use-alerts-controller";
import { UnreadAlertsBadge } from "./unread-alerts-badge";

export function AlertsBell() {
  const { bellRef, openLedger, unreadCount } = useAlertsController();

  return (
    <Button
      ref={bellRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      data-slot="alerts-bell"
      className="relative text-muted-foreground hover:text-foreground"
      aria-label={alertsBellLabel(unreadCount)}
      onClick={openLedger}
    >
      <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
      <UnreadAlertsBadge />
    </Button>
  );
}
