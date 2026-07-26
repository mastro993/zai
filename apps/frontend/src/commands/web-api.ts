import type { WebApiNamespace } from "./web-request-spec";

export const DEFAULT_WEB_API_ORIGIN = "http://127.0.0.1:3000";
export const CASH_FLOW_API_PREFIX = "api/cash-flow";
export const ALERTS_API_PREFIX = "api";

export const resolveWebApiOrigin = (): string => {
  const configuredOrigin = import.meta.env.VITE_ZAI_API_ORIGIN;
  if (typeof configuredOrigin === "string" && configuredOrigin.length > 0) {
    return configuredOrigin.replace(/\/$/, "");
  }

  return DEFAULT_WEB_API_ORIGIN;
};

export const joinWebApiUrl = (origin: string, ...pathSegments: Array<string>): string => {
  const normalizedOrigin = origin.replace(/\/$/, "");
  const path = pathSegments.flatMap((segment) => segment.split("/").filter(Boolean)).join("/");

  return path.length > 0 ? `${normalizedOrigin}/${path}` : normalizedOrigin;
};

export const resolveCashFlowApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), CASH_FLOW_API_PREFIX);

export const resolveAlertsApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), ALERTS_API_PREFIX);

export const resolveWebApiBaseUrl = (api: WebApiNamespace): string =>
  api === "alerts" ? resolveAlertsApiBaseUrl() : resolveCashFlowApiBaseUrl();

export const resolveAlertsEventUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), "api/alerts/events");

export const resolveRecurringProcessingEventUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), "api/cash-flow/recurring-processing/events");
