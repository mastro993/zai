import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";

import type { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import {
  buildCompleteInitialCurrencySetupRequest,
  buildGetCurrenciesRequest,
  buildGetCurrencyBootstrapRequest,
  buildGetCurrencyJobRequest,
  buildGetCurrencyRequest,
  buildGetCurrencyStatusRequest,
  buildGetSupportedCurrenciesRequest,
} from "../web-requests";

const check = <T>(
  build: (args: T) => Result.Result<WebRequestSpec, CommandError>,
  args: T,
  expected: Partial<WebRequestSpec>,
) => {
  const result = build(args);
  expect(Result.isSuccess(result)).toBe(true);
  if (Result.isFailure(result)) return;
  expect(result.value).toMatchObject(expected);
};

describe("currency web requests", () => {
  it("builds bootstrap, catalog, settings, job, and setup paths", () => {
    check(buildGetCurrencyBootstrapRequest, undefined, {
      method: "GET",
      path: "/currencies/bootstrap",
    });
    check(buildGetSupportedCurrenciesRequest, undefined, {
      method: "GET",
      path: "/currencies/catalog",
    });
    check(buildGetCurrenciesRequest, undefined, {
      method: "GET",
      path: "/currencies",
    });
    check(
      buildGetCurrencyRequest,
      { code: "eur" },
      {
        method: "GET",
        path: "/currencies/EUR",
      },
    );
    check(buildGetCurrencyStatusRequest, undefined, {
      method: "GET",
      path: "/currencies/status",
    });
    check(
      buildGetCurrencyJobRequest,
      { jobId: "job-1" },
      {
        method: "GET",
        path: "/currencies/jobs/job-1",
      },
    );
    check(
      buildCompleteInitialCurrencySetupRequest,
      { defaultCurrency: "eur" },
      {
        method: "POST",
        path: "/currencies/setup",
        body: { defaultCurrency: "EUR" },
      },
    );
  });
});
