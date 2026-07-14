export const DEFAULT_WEB_API_ORIGIN = "http://127.0.0.1:3000";

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

export const resolveAlertsEventUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), "api/alerts/events");
