export type WebApiNamespace = "alerts" | "cash-flow";

export type WebRequestSpec = {
  api: WebApiNamespace;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | Array<string>>;
  body?: unknown;
};
