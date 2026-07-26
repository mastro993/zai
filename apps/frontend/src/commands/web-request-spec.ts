export type WebRequestSpec = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | Array<string>>;
  body?: unknown;
};
