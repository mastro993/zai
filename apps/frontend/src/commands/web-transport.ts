import { Result } from "@praha/byethrow";

import { asWireObject, asWireString } from "@/lib/wire";

import { CommandError, commandErrorFromEnvelope, toCommandError } from "./errors";
import type { CommandDescriptor } from "./command-descriptor";
import type { CommandTransport } from "./types";
import { resolveWebApiBaseUrl } from "./web-api";
import type { WebRequestSpec } from "./web-request-spec";

export const buildWebRequestUrl = (baseUrl: string, spec: WebRequestSpec): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = spec.path.startsWith("/") ? spec.path : `/${spec.path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);
  if (spec.query) {
    for (const [key, value] of Object.entries(spec.query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, item);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
};

const parseApiError = async (response: Response): Promise<CommandError> => {
  const bodyResult = await Result.try({
    try: () => response.json(),
    catch: () => undefined,
  });

  if (Result.isSuccess(bodyResult)) {
    const envelopeError = commandErrorFromEnvelope(bodyResult.value);
    if (envelopeError) {
      return envelopeError;
    }
    const message = asWireString(asWireObject(bodyResult.value)?.message);
    if (message !== undefined && message.length > 0) {
      return new CommandError(message);
    }
  }

  return new CommandError(`Request failed with status ${response.status}`);
};

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const result = await Result.try({
    try: () => response.json(),
    catch: toCommandError,
  });

  if (Result.isFailure(result)) {
    return Promise.reject(result.error);
  }

  // SAFETY: CommandTransport.invoke is untyped wire until decodeCommandValue
  // runs the descriptor's Zod result schema.
  return result.value as T;
};

const ZAI_APP_HEADER = "x-zai-app";
const ZAI_APP_HEADER_VALUE = "zai";

const buildWebRequestHeaders = (hasBody: boolean): Headers => {
  const headers = new Headers();
  headers.set(ZAI_APP_HEADER, ZAI_APP_HEADER_VALUE);
  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
};

export const createWebCommandTransport = (): CommandTransport => ({
  invoke: async <TArgs, TResult>(descriptor: CommandDescriptor<TArgs, TResult>, args: TArgs) => {
    const requestResult = descriptor.webRequest(args);
    if (Result.isFailure(requestResult)) {
      return Promise.reject(requestResult.error);
    }
    const spec = requestResult.value;
    const hasBody = spec.body !== undefined;
    const response = await fetch(buildWebRequestUrl(resolveWebApiBaseUrl(), spec), {
      method: spec.method,
      headers: buildWebRequestHeaders(hasBody),
      body: hasBody ? JSON.stringify(spec.body) : undefined,
    });

    if (!response.ok) {
      return Promise.reject(await parseApiError(response));
    }

    if (response.status === 204) {
      // SAFETY: 204 has no body; void commands are the only callers of this branch.
      return undefined as TResult;
    }

    return parseJsonResponse<TResult>(response);
  },
});
