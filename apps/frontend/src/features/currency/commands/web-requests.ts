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

export interface StartCurrencyAdditionArgs {
  code: string;
  confirmProviderDisclosure: boolean;
}

export interface StartDefaultCurrencyChangeArgs {
  code: string;
}

export interface ExchangeRateQuoteArgs {
  source: string;
  target: string;
  date: string;
}

export const buildStartCurrencyAdditionRequest = (
  args: StartCurrencyAdditionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.code)) {
    return Result.fail(new CommandError("Currency code must be a three-letter code"));
  }
  return Result.succeed({
    method: "POST",
    path: `/currencies/${args.code.trim().toUpperCase()}/add`,
    body: { confirmProviderDisclosure: args.confirmProviderDisclosure },
  });
};

export const buildDisableCurrencyRequest = (
  args: CurrencyCodeArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.code)) {
    return Result.fail(new CommandError("Currency code must be a three-letter code"));
  }
  return Result.succeed({
    method: "POST",
    path: `/currencies/${args.code.trim().toUpperCase()}/disable`,
  });
};

export const buildStartDefaultCurrencyChangeRequest = (
  args: StartDefaultCurrencyChangeArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.code)) {
    return Result.fail(new CommandError("Currency code must be a three-letter code"));
  }
  return Result.succeed({
    method: "POST",
    path: "/currencies/default",
    body: { code: args.code.trim().toUpperCase() },
  });
};

export const buildCancelCurrencyJobRequest = (
  args: CurrencyJobArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (args.jobId.trim().length === 0) {
    return Result.fail(new CommandError("Currency job id is required"));
  }
  return Result.succeed({
    method: "POST",
    path: `/currencies/jobs/${args.jobId}/cancel`,
  });
};

export const buildGetTransactionExchangeRateQuoteRequest = (
  args: ExchangeRateQuoteArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isCurrencyCode(args.source) || !isCurrencyCode(args.target)) {
    return Result.fail(new CommandError("Quote currencies must be three-letter codes"));
  }
  if (args.date.trim().length === 0) {
    return Result.fail(new CommandError("Quote date is required"));
  }
  const source = args.source.trim().toUpperCase();
  const target = args.target.trim().toUpperCase();
  return Result.succeed({
    method: "GET",
    path: `/exchange-rates/quote?source=${source}&target=${target}&date=${args.date}`,
  });
};

export const buildRetryExchangeRateRefreshRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "POST", path: "/exchange-rates/refresh" });
