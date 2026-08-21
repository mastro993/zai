import { Result } from "@praha/byethrow";

import { asWireObject, asWireString } from "@/lib/wire";

import { resolveHealthUrl } from "./web-api";

export const HEALTH_POLL_INTERVAL_MS = 500;

export const probeBackendHealth = async (signal?: AbortSignal): Promise<boolean> => {
  const result = await Result.try({
    try: async () => {
      const response = await fetch(resolveHealthUrl(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        return false;
      }
      const body: unknown = await response.json();
      return asWireString(asWireObject(body)?.status) === "ok";
    },
    catch: () => false,
  });

  return Result.isSuccess(result) && result.value;
};

export const waitForPollInterval = async (signal: AbortSignal): Promise<boolean> => {
  const result = await Result.try({
    try: () =>
      new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const timer = window.setTimeout(() => {
          resolve();
        }, HEALTH_POLL_INTERVAL_MS);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(signal.reason);
          },
          { once: true },
        );
      }),
    catch: () => undefined,
  });

  return Result.isSuccess(result);
};
