import { useEffect, useState, type ReactNode } from "react";

import { probeBackendHealth, waitForPollInterval } from "@/commands/web-health";

import { WebBackendPlaceholder, WebBackendSplash } from "./web-backend-splash";

interface WebBackendGateProps {
  enabled: boolean;
  children: ReactNode;
}

type GatePhase = "pending" | "blocked" | "ready";

export function WebBackendGate({ enabled, children }: WebBackendGateProps) {
  const [phase, setPhase] = useState<GatePhase>(enabled ? "pending" : "ready");

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled) {
        return;
      }
      const reachable = await probeBackendHealth(controller.signal);
      if (cancelled) {
        return;
      }
      if (reachable) {
        setPhase("ready");
        return;
      }
      setPhase("blocked");
      const keptWaiting = await waitForPollInterval(controller.signal);
      if (!keptWaiting) {
        return;
      }
      await poll();
    };

    void poll();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  if (phase === "ready") {
    return children;
  }

  if (phase === "pending") {
    return <WebBackendPlaceholder />;
  }

  return <WebBackendSplash />;
}
