import {
  buildAlertCommandRequestSpec,
  ALERT_COMMANDS,
} from "@/features/alerts/commands/web-command-map";
import { buildBudgetCommandRequestSpec } from "@/features/budgets/commands/web-command-map";
import { buildCategoryCommandRequestSpec } from "@/features/categories/commands/web-command-map";
import {
  buildTransactionCommandRequestSpec,
  buildTransactionsListQuery,
} from "@/features/transactions/commands/web-command-map";

import { CommandError } from "./errors";
import type { CommandArgs } from "./types";
import { joinWebApiUrl, resolveWebApiOrigin } from "./web-api";
import type { WebRequestSpec } from "./web-request-spec";

export type { WebRequestSpec } from "./web-request-spec";
export { buildTransactionsListQuery };

export const CASH_FLOW_API_PREFIX = "api/cash-flow";
export const ALERTS_API_PREFIX = "api";

const FEATURE_WEB_REQUEST_BUILDERS = [
  buildAlertCommandRequestSpec,
  buildCategoryCommandRequestSpec,
  buildTransactionCommandRequestSpec,
  buildBudgetCommandRequestSpec,
] as const;

export const resolveCashFlowApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), CASH_FLOW_API_PREFIX);

export const resolveAlertsApiBaseUrl = (): string =>
  joinWebApiUrl(resolveWebApiOrigin(), ALERTS_API_PREFIX);

export const resolveWebApiBaseUrlForCommand = (command: string): string =>
  ALERT_COMMANDS.has(command) ? resolveAlertsApiBaseUrl() : resolveCashFlowApiBaseUrl();

export const buildWebRequestSpec = (command: string, args: CommandArgs = {}): WebRequestSpec => {
  for (const build of FEATURE_WEB_REQUEST_BUILDERS) {
    const spec = build(command, args);
    if (spec) {
      return spec;
    }
  }

  throw new CommandError(`Unknown web command: ${command}`);
};

export const buildWebRequestUrl = (baseUrl: string, spec: WebRequestSpec): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = spec.path.startsWith("/") ? spec.path : `/${spec.path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);
  if (spec.query) {
    for (const [key, value] of Object.entries(spec.query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};
