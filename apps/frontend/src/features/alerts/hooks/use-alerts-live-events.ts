import { useEffect, useRef } from "react";
import { createAlertEventTransport } from "../commands/alert-events";
import { parseDomainAlertEvent } from "../lib/parse";
import { shouldShowUrgentAlertToast, showUrgentAlertToast } from "../lib/urgent-alert-toast";
import type { DomainAlert } from "../types/domain-alert";

interface AlertsLiveEventHandlers {
  onActivateAlert: (alert: DomainAlert) => void;
  onReconcile: () => void;
  onReady: () => void;
}

export function useAlertsLiveEvents({
  onActivateAlert,
  onReconcile,
  onReady,
}: AlertsLiveEventHandlers) {
  const onActivateAlertRef = useRef(onActivateAlert);
  const onReconcileRef = useRef(onReconcile);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onActivateAlertRef.current = onActivateAlert;
    onReconcileRef.current = onReconcile;
    onReadyRef.current = onReady;
  }, [onActivateAlert, onReconcile, onReady]);

  useEffect(() => {
    let active = true;
    const subscription = createAlertEventTransport().subscribe(
      (value) => {
        const event = parseDomainAlertEvent(value);
        if (
          shouldShowUrgentAlertToast(event, {
            hasFocus: () => document.hasFocus(),
            visibilityState: document.visibilityState,
          })
        ) {
          showUrgentAlertToast(event.alert, (alert) => onActivateAlertRef.current(alert));
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
