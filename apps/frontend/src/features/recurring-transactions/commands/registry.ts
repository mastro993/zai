import type { CommandDescriptor } from "@/commands/command-descriptor";

import {
  recurringCreateOutcomeSchema,
  recurringFeedResultSchema,
  recurringMutationOutcomeSchema,
  recurringTransactionDocumentSchema,
} from "../types/recurring-transaction";

const backendCommand = <T>(
  name: string,
  resultSchema: CommandDescriptor<T>["resultSchema"],
): CommandDescriptor<T> => ({
  name,
  transport: "backend",
  resultSchema,
  webMapped: true,
});

export const RECURRING_COMMANDS = {
  get_recurring_transactions: backendCommand(
    "get_recurring_transactions",
    recurringFeedResultSchema,
  ),
  get_recurring_transaction: backendCommand(
    "get_recurring_transaction",
    recurringTransactionDocumentSchema,
  ),
  create_recurring_transaction: backendCommand(
    "create_recurring_transaction",
    recurringCreateOutcomeSchema,
  ),
  rename_recurring_transaction: backendCommand(
    "rename_recurring_transaction",
    recurringMutationOutcomeSchema,
  ),
  edit_recurring_schedule: backendCommand(
    "edit_recurring_schedule",
    recurringMutationOutcomeSchema,
  ),
  edit_recurring_template: backendCommand(
    "edit_recurring_template",
    recurringMutationOutcomeSchema,
  ),
  edit_recurring_count: backendCommand("edit_recurring_count", recurringMutationOutcomeSchema),
} as const;

export const RECURRING_BACKEND_COMMANDS = Object.values(
  RECURRING_COMMANDS,
) as Array<CommandDescriptor>;
