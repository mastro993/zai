import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export interface CompleteInitialCurrencySetupArgs {
  defaultCurrency: string;
}

export interface CurrencyCodeArgs {
  code: string;
}

export interface CurrencyJobArgs {
  jobId: string;
}

const isCurrencyCode = (value: string): boolean => /^[A-Za-z]{3}$/.test(value.trim());

export const buildGetCurrencyBootstrapRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/currencies/bootstrap" });

export const buildGetCurrenciesRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/currencies" });

export const buildGetSupportedCurrenciesRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/currencies/catalog" });

export const buildGetCurrencyRequest = (
  args: CurrencyCodeArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.code)) {
    return Result.fail(new CommandError("Currency code must be a three-letter code"));
  }
  return Result.succeed({
    method: "GET",
    path: `/currencies/${args.code.trim().toUpperCase()}`,
  });
};

export const buildCompleteInitialCurrencySetupRequest = (
  args: CompleteInitialCurrencySetupArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.defaultCurrency)) {
    return Result.fail(new CommandError("Default currency must be a three-letter code"));
  }
  return Result.succeed({
    method: "POST",
    path: "/currencies/setup",
    body: { defaultCurrency: args.defaultCurrency.trim().toUpperCase() },
  });
};

export const buildGetCurrencyJobRequest = (
  args: CurrencyJobArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (args.jobId.trim().length === 0) {
    return Result.fail(new CommandError("Currency job id is required"));
  }
  return Result.succeed({
    method: "GET",
    path: `/currencies/jobs/${args.jobId}`,
  });
};

export const buildGetCurrencyStatusRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/currencies/status" });
