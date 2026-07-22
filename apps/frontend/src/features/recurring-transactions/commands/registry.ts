import type { CommandDescriptor } from "@/commands/command-descriptor";

import {
  adoptionPreviewSchema,
  generationFailureDiagnosticsSchema,
  recurringAdoptOutcomeSchema,
  recurringCreateOutcomeSchema,
  recurringFailurePageSchema,
  recurringFeedResultSchema,
  recurringLifecycleOutcomeSchema,
  recurringMutationOutcomeSchema,
  recurringOccurrencePageSchema,
  recurringRecoveryOutcomeSchema,
  recurringRepairPreviewSchema,
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
  adopt_recurring_transaction: backendCommand(
    "adopt_recurring_transaction",
    recurringAdoptOutcomeSchema,
  ),
  create_recurring_transaction: backendCommand(
    "create_recurring_transaction",
    recurringCreateOutcomeSchema,
  ),
  get_recurring_transaction: backendCommand(
    "get_recurring_transaction",
    recurringTransactionDocumentSchema,
  ),
  get_recurring_transaction_occurrences: backendCommand(
    "get_recurring_transaction_occurrences",
    recurringOccurrencePageSchema,
  ),
  get_recurring_transaction_failure_history: backendCommand(
    "get_recurring_transaction_failure_history",
    recurringFailurePageSchema,
  ),
  get_recurring_generation_failure_diagnostics: backendCommand(
    "get_recurring_generation_failure_diagnostics",
    generationFailureDiagnosticsSchema,
  ),
  get_recurring_transactions: backendCommand(
    "get_recurring_transactions",
    recurringFeedResultSchema,
  ),
  get_transaction_recurring_provenance: backendCommand(
    "get_transaction_recurring_provenance",
    transactionRecurringProvenanceSchema.nullable(),
  ),
  pause_recurring_transaction: backendCommand(
    "pause_recurring_transaction",
    recurringLifecycleOutcomeSchema,
  ),
  preview_recurring_adoption: backendCommand("preview_recurring_adoption", adoptionPreviewSchema),
  preview_recurring_generation_repair: backendCommand(
    "preview_recurring_generation_repair",
    recurringRepairPreviewSchema,
  ),
  repair_recurring_generation_failure: backendCommand(
    "repair_recurring_generation_failure",
    recurringRecoveryOutcomeSchema,
  ),
  retry_recurring_generation_failure: backendCommand(
    "retry_recurring_generation_failure",
    recurringRecoveryOutcomeSchema,
  ),
  resume_recurring_transaction: backendCommand(
    "resume_recurring_transaction",
    recurringLifecycleOutcomeSchema,
  ),
  stop_recurring_transaction: backendCommand(
    "stop_recurring_transaction",
    recurringLifecycleOutcomeSchema,
  ),
  delete_recurring_transaction: backendCommand(
    "delete_recurring_transaction",
    recurringLifecycleOutcomeSchema,
  ),
  update_recurring_transaction: backendCommand(
    "update_recurring_transaction",
    recurringMutationOutcomeSchema,
  ),
} as const;

export const RECURRING_BACKEND_COMMANDS = Object.values(
  RECURRING_COMMANDS,
) as Array<CommandDescriptor>;
