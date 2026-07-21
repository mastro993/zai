import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import {
  recurringCreateOutcomeSchema,
  recurringFeedResultSchema,
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
} as const;

export const RECURRING_BACKEND_COMMANDS = Object.values(
  RECURRING_COMMANDS,
) as Array<CommandDescriptor>;
