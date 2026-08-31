import { ALERT_BACKEND_COMMANDS } from "@/features/alerts/commands/registry";
import { BUDGET_BACKEND_COMMANDS } from "@/features/budgets/commands/registry";
import { CATEGORY_BACKEND_COMMANDS } from "@/features/categories/commands/registry";
import { CURRENCY_BACKEND_COMMANDS } from "@/features/currency/commands/registry";
import { RECURRING_BACKEND_COMMANDS } from "@/features/recurring-transactions/commands/registry";
import { DIAGNOSTICS_BACKEND_COMMANDS } from "@/features/settings/commands/registry";
import { TRANSACTION_BACKEND_COMMANDS } from "@/features/transactions/commands/registry";

export type { CommandDescriptor } from "./command-descriptor";
export { decodeCommandValue } from "./decode-command-result";
export { invokeDecodedCommand } from "./shared";

export const BACKEND_COMMAND_REGISTRY = [
  ...BUDGET_BACKEND_COMMANDS,
  ...CURRENCY_BACKEND_COMMANDS,
  ...CATEGORY_BACKEND_COMMANDS,
  ...TRANSACTION_BACKEND_COMMANDS,
  ...ALERT_BACKEND_COMMANDS,
  ...RECURRING_BACKEND_COMMANDS,
  ...DIAGNOSTICS_BACKEND_COMMANDS,
] as const;

export const BACKEND_COMMAND_NAMES = BACKEND_COMMAND_REGISTRY.map((descriptor) => descriptor.name);
