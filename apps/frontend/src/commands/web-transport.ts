import { CommandError } from "./errors";
import type { CommandArgs, CommandTransport } from "./types";
import {
  buildWebRequestSpec,
  buildWebRequestUrl,
  resolveCashFlowApiBaseUrl,
} from "./web-command-map";

type ApiErrorBody = {
  message?: string;
};

const parseApiErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.message === "string" && body.message.length > 0) {
      return body.message;
    }
  } catch {
    // ponytail: fall back to status text when error body is missing or malformed
  }

  return `Request failed with status ${response.status}`;
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
      throw new CommandError(await parseApiErrorMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new CommandError(
        error instanceof Error ? error.message : "Failed to parse response JSON",
      );
    }
  },
});
