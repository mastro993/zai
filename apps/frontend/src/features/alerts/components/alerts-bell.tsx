import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { alertsBellLabel } from "../lib/format";
import { useAlertsController } from "../hooks/use-alerts-controller";
import { AlertsLedgerDrawer } from "./alerts-ledger-drawer";

export function AlertsBell() {
  const { bellRef, openLedger, unreadCount } = useAlertsController();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <>
      <Button
        ref={bellRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        className="relative text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label={alertsBellLabel(unreadCount)}
        onClick={openLedger}
      >
        <HugeiconsIcon icon={Notification03Icon} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "absolute top-1.5 right-1.5 size-2 rounded-full bg-primary",
              !prefersReducedMotion && "animate-pulse",
            )}
            aria-hidden
          />
        ) : null}
      </Button>
      <AlertsLedgerDrawer />
    </>
  );
}
