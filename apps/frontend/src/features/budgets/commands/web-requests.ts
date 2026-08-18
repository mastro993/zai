import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

import type {
  Budget,
  BudgetListFilter,
  BudgetMeasurementMode,
  BudgetRolloverMode,
} from "../types/budget";

export interface GetBudgetsArgs {
  filter?: BudgetListFilter | null;
}

export interface BudgetIdentifierArgs {
  budgetId: string;
}

export interface BudgetRevisionArgs extends BudgetIdentifierArgs {
  expectedRevision: number;
}

export interface BudgetHistoryArgs extends BudgetIdentifierArgs {
  page?: number;
  perPage?: number;
}

export interface BudgetPayload {
  name: string;
  baseAllowance: number;
  cadence: Budget["cadence"];
  categoryIds: Array<string>;
  measurementMode: BudgetMeasurementMode;
  rolloverMode: BudgetRolloverMode;
  warningPercentage: number | null;
}

export interface CreateBudgetArgs {
  newBudget: BudgetPayload;
}

export interface UpdateBudgetArgs extends BudgetIdentifierArgs {
  updatedBudget: BudgetPayload & { expectedRevision: number };
}

const isNonEmptyString = (value: string): boolean => value.length > 0;

const isNonNegativeInteger = (value: number): boolean => Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0;

const validateIdentifier = (
  args: BudgetIdentifierArgs,
): Result.Result<BudgetIdentifierArgs, CommandError> => {
  if (!isNonEmptyString(args.budgetId)) {
    return Result.fail(new CommandError("Budget id must be a non-empty string"));
  }
  return Result.succeed({ budgetId: args.budgetId });
};

const validateRevision = (
  args: BudgetRevisionArgs,
): Result.Result<BudgetRevisionArgs, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) {
    return identifier;
  }
  if (!isNonNegativeInteger(args.expectedRevision)) {
    return Result.fail(new CommandError("Budget revision must be a non-negative integer"));
  }
  return Result.succeed({ ...identifier.value, expectedRevision: args.expectedRevision });
};

export const buildGetBudgetsRequest = (
  args: GetBudgetsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const filter = args.filter;
  if (
    filter !== undefined &&
    filter !== null &&
    filter !== "active" &&
    filter !== "paused" &&
    filter !== "all"
  ) {
    return Result.fail(new CommandError("Budget filter is invalid"));
  }
  return Result.succeed({
    method: "GET",
    path: "/budgets",
    query: filter ? { filter } : undefined,
  });
};

export const buildGetBudgetRequest = (
  args: BudgetIdentifierArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const validArgs = validateIdentifier(args);
  return Result.isFailure(validArgs)
    ? validArgs
    : Result.succeed({
        method: "GET",
        path: `/budgets/${validArgs.value.budgetId}`,
      });
};

export const buildCreateBudgetRequest = (
  args: CreateBudgetArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.newBudget.name)) {
    return Result.fail(new CommandError("Budget payload must be a valid record"));
  }
  return Result.succeed({
    method: "POST",
    path: "/budgets",
    body: args.newBudget,
  });
};

export const buildUpdateBudgetRequest = (
  args: UpdateBudgetArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isNonEmptyString(args.budgetId) || !isNonEmptyString(args.updatedBudget.name)) {
    return Result.fail(new CommandError("Budget update requires a valid id and payload"));
  }
  if (!isNonNegativeInteger(args.updatedBudget.expectedRevision)) {
    return Result.fail(new CommandError("Budget revision must be a non-negative integer"));
  }
  const { expectedRevision: _expectedRevision, ...body } = args.updatedBudget;
  return Result.succeed({
    method: "PUT",
    path: `/budgets/${args.budgetId}`,
    body: { expectedRevision: args.updatedBudget.expectedRevision, ...body },
  });
};

export const buildDeleteBudgetRequest = (
  args: BudgetRevisionArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const validArgs = validateRevision(args);
  return Result.isFailure(validArgs)
    ? validArgs
    : Result.succeed({
        method: "DELETE",
        path: `/budgets/${validArgs.value.budgetId}`,
        body: { expectedRevision: validArgs.value.expectedRevision },
      });
};

export const buildGetBudgetHistoryRequest = (
  args: BudgetHistoryArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) {
    return identifier;
  }
  if (
    (args.page !== undefined && !isPositiveInteger(args.page)) ||
    (args.perPage !== undefined && !isPositiveInteger(args.perPage))
  ) {
    return Result.fail(new CommandError("Budget history pagination must use positive integers"));
  }
  return Result.succeed({
    method: "GET",
    path: `/budgets/${identifier.value.budgetId}/history`,
    query: { page: String(args.page ?? 1), perPage: String(args.perPage ?? 50) },
  });
};

const buildBudgetLifecycleRequest = (
  args: BudgetRevisionArgs,
  action: "pause" | "resume",
): Result.Result<WebRequestSpec, CommandError> => {
  const validArgs = validateRevision(args);
  return Result.isFailure(validArgs)
    ? validArgs
    : Result.succeed({
        method: "POST",
        path: `/budgets/${validArgs.value.budgetId}/${action}`,
        body: { expectedRevision: validArgs.value.expectedRevision },
      });
};

export const buildPauseBudgetRequest = (
  args: BudgetRevisionArgs,
): Result.Result<WebRequestSpec, CommandError> => buildBudgetLifecycleRequest(args, "pause");

export const buildResumeBudgetRequest = (
  args: BudgetRevisionArgs,
): Result.Result<WebRequestSpec, CommandError> => buildBudgetLifecycleRequest(args, "resume");
