import { asWireString } from "@/lib/wire";

export const DEFAULT_WEB_API_ORIGIN = "http://127.0.0.1:3000";
export const WEB_API_PREFIX = "api";

export const resolveWebApiOrigin = (): string => {
  const configuredOrigin = import.meta.env.VITE_ZAI_API_ORIGIN;
  const origin = asWireString(configuredOrigin);
  if (origin !== undefined && origin.length > 0) {
    return origin.replace(/\/$/, "");
  }

  return DEFAULT_WEB_API_ORIGIN;
};

export const joinWebApiUrl = (origin: string, ...pathSegments: Array<string>): string => {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const path = pathSegments.flatMap((segment) => segment.split("/").filter(Boolean)).join("/");

  return path.length > 0 ? `${normalizedOrigin}/${path}` : normalizedOrigin;
};

export const resolveWebApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), WEB_API_PREFIX);

export const resolveAlertsEventUrl = (): string =>
  joinWebApiUrl(resolveWebApiBaseUrl(), "alerts/events");

export const resolveRecurringProcessingEventUrl = (): string =>
  joinWebApiUrl(resolveWebApiBaseUrl(), "recurring-processing/events");
