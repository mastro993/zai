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
  resolveCashFlowApiBaseUrl,
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

export const createWebCommandTransport = (): CommandTransport => ({
  invoke: async <T>(command: string, args?: CommandArgs) => {
    const spec = buildWebRequestSpec(command, args);
    const response = await fetch(buildWebRequestUrl(resolveCashFlowApiBaseUrl(), spec), {
      method: spec.method,
      headers: spec.body ? { "Content-Type": "application/json" } : undefined,
      body: spec.body ? JSON.stringify(spec.body) : undefined,
    });

    if (!response.ok) {
      return Promise.reject(await parseApiError(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return parseJsonResponse<T>(response);
  },
});
