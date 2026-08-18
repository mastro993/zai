import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";
import type { z } from "zod";

import {
  recurringBulkExecuteResultSchema,
  recurringBulkPreflightSchema,
  recurringMatchingIdsSchema,
} from "../types/recurring-bulk";
import {
  adoptionPreviewSchema,
  budgetProjectionResultSchema,
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
import { recurringProcessingStatusViewSchema } from "../types/recurring-processing-status";
import {
  buildAdoptRecurringTransactionRequest,
  buildCreateRecurringTransactionRequest,
  buildDeleteRecurringTransactionRequest,
  buildExecuteRecurringBulkRequest,
  buildGetRecurringDiagnosticsRequest,
  buildGetRecurringFailureHistoryRequest,
  buildGetRecurringOccurrencesRequest,
  buildGetRecurringProcessingStatusRequest,
  buildGetRecurringProjectionsRequest,
  buildGetRecurringTransactionRequest,
  buildGetRecurringTransactionsRequest,
  buildGetTransactionProvenanceRequest,
  buildMatchingRecurringIdsRequest,
  buildPauseRecurringTransactionRequest,
  buildPreviewRecurringAdoptionRequest,
  buildPreviewRecurringRepairRequest,
  buildPreflightRecurringBulkRequest,
  buildRepairRecurringFailureRequest,
  buildResumeRecurringTransactionRequest,
  buildRetryRecurringFailureRequest,
  buildStopRecurringTransactionRequest,
  buildUpdateRecurringTransactionRequest,
} from "./web-requests";

const backendCommand = <TArgs, T>(
  name: string,
  resultSchema: z.ZodType<T>,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs, T>>[2],
): CommandDescriptor<TArgs, T> => createCommandDescriptor(name, resultSchema, webRequest);

export const RECURRING_COMMANDS = {
  adopt_recurring_transaction: backendCommand(
    "adopt_recurring_transaction",
    recurringAdoptOutcomeSchema,
    buildAdoptRecurringTransactionRequest,
  ),
  create_recurring_transaction: backendCommand(
    "create_recurring_transaction",
    recurringCreateOutcomeSchema,
    buildCreateRecurringTransactionRequest,
  ),
  get_recurring_transaction: backendCommand(
    "get_recurring_transaction",
    recurringTransactionDocumentSchema,
    buildGetRecurringTransactionRequest,
  ),
  get_recurring_transaction_occurrences: backendCommand(
    "get_recurring_transaction_occurrences",
    recurringOccurrencePageSchema,
    buildGetRecurringOccurrencesRequest,
  ),
  get_recurring_transaction_failure_history: backendCommand(
    "get_recurring_transaction_failure_history",
    recurringFailurePageSchema,
    buildGetRecurringFailureHistoryRequest,
  ),
  get_recurring_generation_failure_diagnostics: backendCommand(
    "get_recurring_generation_failure_diagnostics",
    generationFailureDiagnosticsSchema,
    buildGetRecurringDiagnosticsRequest,
  ),
  get_recurring_transactions: backendCommand(
    "get_recurring_transactions",
    recurringFeedResultSchema,
    buildGetRecurringTransactionsRequest,
  ),
  get_recurring_budget_projections: backendCommand(
    "get_recurring_budget_projections",
    budgetProjectionResultSchema,
    buildGetRecurringProjectionsRequest,
  ),
  get_recurring_processing_status: backendCommand(
    "get_recurring_processing_status",
    recurringProcessingStatusViewSchema,
    buildGetRecurringProcessingStatusRequest,
  ),
  get_matching_recurring_transaction_ids: backendCommand(
    "get_matching_recurring_transaction_ids",
    recurringMatchingIdsSchema,
    buildMatchingRecurringIdsRequest,
  ),
  get_transaction_recurring_provenance: backendCommand(
    "get_transaction_recurring_provenance",
    transactionRecurringProvenanceSchema.nullable(),
    buildGetTransactionProvenanceRequest,
  ),
  pause_recurring_transaction: backendCommand(
    "pause_recurring_transaction",
    recurringLifecycleOutcomeSchema,
    buildPauseRecurringTransactionRequest,
  ),
  preview_recurring_adoption: backendCommand(
    "preview_recurring_adoption",
    adoptionPreviewSchema,
    buildPreviewRecurringAdoptionRequest,
  ),
  preview_recurring_generation_repair: backendCommand(
    "preview_recurring_generation_repair",
    recurringRepairPreviewSchema,
    buildPreviewRecurringRepairRequest,
  ),
  preflight_recurring_bulk: backendCommand(
    "preflight_recurring_bulk",
    recurringBulkPreflightSchema,
    buildPreflightRecurringBulkRequest,
  ),
  execute_recurring_bulk: backendCommand(
    "execute_recurring_bulk",
    recurringBulkExecuteResultSchema,
    buildExecuteRecurringBulkRequest,
  ),
  repair_recurring_generation_failure: backendCommand(
    "repair_recurring_generation_failure",
    recurringRecoveryOutcomeSchema,
    buildRepairRecurringFailureRequest,
  ),
  retry_recurring_generation_failure: backendCommand(
    "retry_recurring_generation_failure",
    recurringRecoveryOutcomeSchema,
    buildRetryRecurringFailureRequest,
  ),
  resume_recurring_transaction: backendCommand(
    "resume_recurring_transaction",
    recurringLifecycleOutcomeSchema,
    buildResumeRecurringTransactionRequest,
  ),
  stop_recurring_transaction: backendCommand(
    "stop_recurring_transaction",
    recurringLifecycleOutcomeSchema,
    buildStopRecurringTransactionRequest,
  ),
  delete_recurring_transaction: backendCommand(
    "delete_recurring_transaction",
    recurringLifecycleOutcomeSchema,
    buildDeleteRecurringTransactionRequest,
  ),
  update_recurring_transaction: backendCommand(
    "update_recurring_transaction",
    recurringMutationOutcomeSchema,
    buildUpdateRecurringTransactionRequest,
  ),
} as const;

export const RECURRING_BACKEND_COMMANDS = Object.values(RECURRING_COMMANDS);
