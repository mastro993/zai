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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const validateIdentifier = (args: unknown): Result.Result<BudgetIdentifierArgs, CommandError> => {
  if (!isRecord(args) || !isNonEmptyString(args.budgetId)) {
    return Result.fail(new CommandError("Budget id must be a non-empty string"));
  }
  return Result.succeed({ budgetId: args.budgetId });
};

const validateRevision = (args: unknown): Result.Result<BudgetRevisionArgs, CommandError> => {
  const identifier = validateIdentifier(args);
  if (Result.isFailure(identifier)) {
    return identifier;
  }
  if (!isRecord(args) || !isRevision(args.expectedRevision)) {
    return Result.fail(new CommandError("Budget revision must be a non-negative integer"));
  }
  return Result.succeed({ ...identifier.value, expectedRevision: args.expectedRevision });
};

const validatePayload = (value: unknown): value is BudgetPayload =>
  isRecord(value) &&
  isNonEmptyString(value.name) &&
  typeof value.baseAllowance === "number" &&
  Number.isInteger(value.baseAllowance) &&
  typeof value.cadence === "string" &&
  Array.isArray(value.categoryIds) &&
  value.categoryIds.every((id) => typeof id === "string") &&
  typeof value.measurementMode === "string" &&
  typeof value.rolloverMode === "string" &&
  (value.warningPercentage === null || typeof value.warningPercentage === "number");

export const buildGetBudgetsRequest = (
  args: GetBudgetsArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args)) {
    return Result.fail(new CommandError("Budget list arguments must be a record"));
  }
  const filter = (args as GetBudgetsArgs).filter;
  if (
    filter !== undefined &&
    filter !== null &&
    !["active", "paused", "all"].includes(String(filter))
  ) {
    return Result.fail(new CommandError("Budget filter is invalid"));
  }
  return Result.succeed({
    api: "cash-flow",
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
        api: "cash-flow",
        method: "GET",
        path: `/budgets/${validArgs.value.budgetId}`,
      });
};

export const buildCreateBudgetRequest = (
  args: CreateBudgetArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !validatePayload(args.newBudget)) {
    return Result.fail(new CommandError("Budget payload must be a valid record"));
  }
  return Result.succeed({
    api: "cash-flow",
    method: "POST",
    path: "/budgets",
    body: args.newBudget,
  });
};

export const buildUpdateBudgetRequest = (
  args: UpdateBudgetArgs,
): Result.Result<WebRequestSpec, CommandError> => {
  if (!isRecord(args) || !isNonEmptyString(args.budgetId) || !validatePayload(args.updatedBudget)) {
    return Result.fail(new CommandError("Budget update requires a valid id and payload"));
  }
  if (!isRevision(args.updatedBudget.expectedRevision)) {
    return Result.fail(new CommandError("Budget revision must be a non-negative integer"));
  }
  const { expectedRevision: _expectedRevision, ...body } = args.updatedBudget;
  return Result.succeed({
    api: "cash-flow",
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
        api: "cash-flow",
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
    !isRecord(args) ||
    (args.page !== undefined && !isPositiveInteger(args.page)) ||
    (args.perPage !== undefined && !isPositiveInteger(args.perPage))
  ) {
    return Result.fail(new CommandError("Budget history pagination must use positive integers"));
  }
  return Result.succeed({
    api: "cash-flow",
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
        api: "cash-flow",
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
