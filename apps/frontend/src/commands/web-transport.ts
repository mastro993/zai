import { Result } from "@praha/byethrow";

import {
  CommandError,
  commandErrorFromEnvelope,
  toCommandError,
  type CommandErrorEnvelope,
} from "./errors";
import type { CommandArgs, CommandTransport } from "./types";
import {
  buildWebRequestSpec,
  buildWebRequestUrl,
  resolveWebApiBaseUrlForCommand,
} from "./web-command-map";

const parseApiError = async (response: Response): Promise<CommandError> => {
  const bodyResult = await Result.try({
    try: () => response.json(),
    catch: () => undefined,
  });

  if (Result.isSuccess(bodyResult)) {
    const body = bodyResult.value as Partial<CommandErrorEnvelope>;
    const envelopeError = commandErrorFromEnvelope(body);
    if (envelopeError) {
      return envelopeError;
    }
    if (typeof body.message === "string" && body.message.length > 0) {
      return new CommandError(body.message);
    }
  }

  return new CommandError(`Request failed with status ${response.status}`);
};

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const result = await Result.try({
    try: () => response.json() as Promise<T>,
    catch: toCommandError,
  });

  return Result.isSuccess(result) ? result.value : Promise.reject(result.error);
};

const ZAI_APP_HEADER = "x-zai-app";
const ZAI_APP_HEADER_VALUE = "zai";

const buildWebRequestHeaders = (hasBody: boolean): Record<string, string> => {
  const headers: Record<string, string> = {
    [ZAI_APP_HEADER]: ZAI_APP_HEADER_VALUE,
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

export const createWebCommandTransport = (): CommandTransport => ({
  invoke: async <T>(command: string, args?: CommandArgs) => {
    const spec = buildWebRequestSpec(command, args);
    const hasBody = spec.body !== undefined;
    const response = await fetch(
      buildWebRequestUrl(resolveWebApiBaseUrlForCommand(command), spec),
      {
        method: spec.method,
        headers: buildWebRequestHeaders(hasBody),
        body: hasBody ? JSON.stringify(spec.body) : undefined,
      },
    );

    if (!response.ok) {
      return Promise.reject(await parseApiError(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return parseJsonResponse<T>(response);
  },
});
