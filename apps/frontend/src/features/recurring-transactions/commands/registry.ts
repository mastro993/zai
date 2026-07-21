import type { CommandDescriptor } from "@/commands/command-descriptor";

import {
  adoptionPreviewSchema,
  recurringAdoptOutcomeSchema,
  recurringCreateOutcomeSchema,
  recurringFeedResultSchema,
  recurringOccurrencePageSchema,
  recurringTransactionDocumentSchema,
  transactionRecurringProvenanceSchema,
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
  get_recurring_transaction_occurrences: backendCommand(
    "get_recurring_transaction_occurrences",
    recurringOccurrencePageSchema,
  ),
  get_transaction_recurring_provenance: backendCommand(
    "get_transaction_recurring_provenance",
    transactionRecurringProvenanceSchema.nullable(),
  ),
  create_recurring_transaction: backendCommand(
    "create_recurring_transaction",
    recurringCreateOutcomeSchema,
  ),
  preview_recurring_adoption: backendCommand("preview_recurring_adoption", adoptionPreviewSchema),
  adopt_recurring_transaction: backendCommand(
    "adopt_recurring_transaction",
    recurringAdoptOutcomeSchema,
  ),
} as const;

export const RECURRING_BACKEND_COMMANDS = Object.values(
  RECURRING_COMMANDS,
) as Array<CommandDescriptor>;
