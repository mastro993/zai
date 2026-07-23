import { useEffect, useRef } from "react";

import { createRecurringProcessingEventTransport } from "../commands/recurring-processing-events";
import { parseRecurringProcessingEvent } from "../lib/parse-recurring-processing-event";

interface RecurringProcessingLiveEventHandlers {
  onReconcile: () => void;
  onReady: () => void;
}

export function useRecurringProcessingLiveEvents({
  onReconcile,
  onReady,
}: RecurringProcessingLiveEventHandlers) {
  const onReconcileRef = useRef(onReconcile);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReconcileRef.current = onReconcile;
    onReadyRef.current = onReady;
  }, [onReconcile, onReady]);

  useEffect(() => {
    let active = true;
    const subscription = createRecurringProcessingEventTransport().subscribe(
      (value) => {
        parseRecurringProcessingEvent(value);
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
