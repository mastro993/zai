import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import type { ListDomainAlertsQuery } from "../types/domain-alert";

export interface ListAlertsArgs {
  query?: ListDomainAlertsQuery | null;
}

export interface MarkAlertArgs {
  alertId: string;
}

const isNonEmptyString = (value: string): boolean => value.length > 0;

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

const validateListArgs = (args: ListAlertsArgs): Result.Result<ListAlertsArgs, CommandError> => {
  const query = args.query;
  if (query === undefined || query === null) {
    return Result.succeed({});
  }
  if (query.cursor !== undefined && !isNonEmptyString(query.cursor)) {
    return Result.fail(new CommandError("Alert cursor must be a non-empty string"));
  }
  if (query.limit !== undefined && !isPositiveInteger(query.limit)) {
    return Result.fail(new CommandError("Alert limit must be a positive integer"));
  }

  return Result.succeed({ query });
};

const buildAlertListQuery = (query: ListDomainAlertsQuery | null | undefined) => {
  const params: Record<string, string | Array<string>> = {};
  if (!query) {
    return params;
  }
  if (query.cursor) {
    params.cursor = query.cursor;
  }
  if (query.limit !== undefined) {
    params.limit = String(query.limit);
  }
  if (query.readState && query.readState !== "all") {
    params.readState = query.readState;
  }
  if (query.severities) {
    params.severities = query.severities;
  }
  return params;
};

export const buildListAlertsRequest = (
  args: ListAlertsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const validArgs = validateListArgs(args);
  if (Result.isFailure(validArgs)) {
    return validArgs;
  }
  const query = buildAlertListQuery(validArgs.value.query);
  return Result.succeed({
    method: "GET",
    path: "/alerts",
    query: Object.keys(query).length > 0 ? query : undefined,
  });
};

export const buildGetUnreadAlertCountRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/alerts/unread-count" });

export const buildMarkAllAlertsReadRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "POST", path: "/alerts/mark-all-read", body: {} });

const buildMarkAlertRequest = (
  args: MarkAlertArgs,
  action: "read" | "unread",
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.alertId)) {
    return Result.fail(new CommandError("Alert id must be a non-empty string"));
  }
  return Result.succeed({
    method: "POST",
    path: `/alerts/${args.alertId}/${action}`,
    body: {},
  });
};

export const buildMarkAlertReadRequest = (
  args: MarkAlertArgs,
): Result.Result<WebRequestSpec, CommandError> => buildMarkAlertRequest(args, "read");

export const buildMarkAlertUnreadRequest = (
  args: MarkAlertArgs,
): Result.Result<WebRequestSpec, CommandError> => buildMarkAlertRequest(args, "unread");
