import { Result } from "@praha/byethrow";

import { CommandError, toCommandError } from "@/commands/errors";

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

export const digestTransactionImportFile = (
  content: string,
): Result.ResultAsync<string, CommandError> =>
  Result.try({
    try: async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
      return toHex(digest);
    },
    catch: toCommandError,
  });
