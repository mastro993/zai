import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { createAlertEventTransport } from "../commands/alert-events";
import { parseDomainAlertEvent } from "../lib/parse";

interface AlertsLiveEventHandlers {
  onOpenLedger: () => void;
  onReconcile: () => void;
  onReady: () => void;
}

export function useAlertsLiveEvents({
  onOpenLedger,
  onReconcile,
  onReady,
}: AlertsLiveEventHandlers) {
  const onOpenLedgerRef = useRef(onOpenLedger);
  const onReconcileRef = useRef(onReconcile);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onOpenLedgerRef.current = onOpenLedger;
    onReconcileRef.current = onReconcile;
    onReadyRef.current = onReady;
  }, [onOpenLedger, onReconcile, onReady]);

  useEffect(() => {
    let active = true;
    const subscription = createAlertEventTransport().subscribe(
      (value) => {
        const event = parseDomainAlertEvent(value);
        if (
          event?.type === "created" &&
          (event.alert.severity === "warning" || event.alert.severity === "critical") &&
          document.visibilityState === "visible" &&
          document.hasFocus()
        ) {
          toast.warning(event.alert.title, {
            description: event.alert.body,
            action: {
              label: "Open alerts",
              onClick: () => onOpenLedgerRef.current(),
            },
          });
        }
        onReconcileRef.current();
      },
      () => onReconcileRef.current(),
    );
    void subscription.ready.then(() => {
      if (active) {
        onReadyRef.current();
      }
    });

    return () => {
      active = false;
      subscription.close();
    };
  }, []);

  useEffect(() => {
    const reconcileOnFocus = () => onReconcileRef.current();
    const reconcileOnVisibility = () => {
      if (document.visibilityState === "visible") {
        onReconcileRef.current();
      }
    };

    window.addEventListener("focus", reconcileOnFocus);
    document.addEventListener("visibilitychange", reconcileOnVisibility);

    return () => {
      window.removeEventListener("focus", reconcileOnFocus);
      document.removeEventListener("visibilitychange", reconcileOnVisibility);
    };
  }, []);
}
