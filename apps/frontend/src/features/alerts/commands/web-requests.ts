import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import type {
  DomainAlertReadState,
  DomainAlertSeverity,
  ListDomainAlertsQuery,
} from "../types/domain-alert";

export interface ListAlertsArgs {
  query?: ListDomainAlertsQuery | null;
}

export interface MarkAlertArgs {
  alertId: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isReadState = (value: unknown): value is DomainAlertReadState =>
  value === "all" || value === "read" || value === "unread";

const isSeverity = (value: unknown): value is DomainAlertSeverity =>
  value === "info" || value === "warning" || value === "critical";

const validateListArgs = (args: unknown): Result.Result<ListAlertsArgs, CommandError> => {
  if (!isRecord(args)) {
    return Result.fail(new CommandError("Alert list arguments must be a record"));
  }

  const query = args.query;
  if (query === undefined || query === null) {
    return Result.succeed({});
  }
  if (!isRecord(query)) {
    return Result.fail(new CommandError("Alert list query must be a record"));
  }
  if (query.cursor !== undefined && !isNonEmptyString(query.cursor)) {
    return Result.fail(new CommandError("Alert cursor must be a non-empty string"));
  }
  if (
    query.limit !== undefined &&
    (typeof query.limit !== "number" || !Number.isInteger(query.limit) || query.limit < 1)
  ) {
    return Result.fail(new CommandError("Alert limit must be a positive integer"));
  }
  if (query.readState !== undefined && !isReadState(query.readState)) {
    return Result.fail(new CommandError("Alert read state is invalid"));
  }
  if (
    query.severities !== undefined &&
    (!Array.isArray(query.severities) || query.severities.some((severity) => !isSeverity(severity)))
  ) {
    return Result.fail(new CommandError("Alert severities must be an array of valid values"));
  }

  return Result.succeed({ query: query as ListDomainAlertsQuery });
};

const buildAlertListQuery = (
  query: ListDomainAlertsQuery | null | undefined,
): Record<string, string | Array<string>> => {
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
  if (!isRecord(args) || !isNonEmptyString(args.alertId)) {
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
