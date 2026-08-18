import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export interface CompleteInitialCurrencySetupArgs {
  defaultCurrency: string;
}

export const buildCompleteInitialCurrencySetupRequest = (
  args: CompleteInitialCurrencySetupArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (args.defaultCurrency.trim().length !== 3) {
    return Result.fail(new CommandError("Default currency must be a three-letter code"));
  }
  return Result.succeed({
    method: "POST",
    path: "/currency/setup",
    body: { defaultCurrency: args.defaultCurrency },
  });
};
