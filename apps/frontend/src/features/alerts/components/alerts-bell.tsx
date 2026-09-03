import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

import { alertsBellLabel } from "../lib/format";
import { useAlertsController } from "../hooks/use-alerts-controller";
import { AlertsLedgerDrawer } from "./alerts-ledger-drawer";

export function AlertsBell() {
  const { bellRef, openLedger, unreadCount } = useAlertsController();

  return (
    <>
      <Button
        ref={bellRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative text-muted-foreground/70 hover:text-foreground"
        aria-label={alertsBellLabel(unreadCount)}
        onClick={openLedger}
      >
        <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            className="absolute top-1 right-1 size-1.5 rounded-full bg-primary ring-1 ring-background [corner-shape:round]"
            aria-hidden
          />
        ) : null}
      </Button>
      <AlertsLedgerDrawer />
    </>
  );
}
