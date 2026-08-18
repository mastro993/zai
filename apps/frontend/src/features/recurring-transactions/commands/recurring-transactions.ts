import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";
import type { Transaction } from "@/features/transactions/types/model";

import type {
  RecurringBulkAction,
  RecurringBulkExecuteResult,
  RecurringBulkItem,
  RecurringBulkPreflight,
  RecurringMatchingIds,
} from "../types/recurring-bulk";
import type {
  AdoptionPreview,
  BudgetProjectionResult,
  GenerationFailureDiagnostics,
  RecurringAdoptOutcome,
  RecurringCreateOutcome,
  RecurringFailurePage,
  RecurringFeedResult,
  RecurringFeedFilters,
  RecurringFormValues,
  RecurringLifecycleOutcome,
  RecurringMutationOutcome,
  RecurringOccurrencePage,
  RecurringRecoveryOutcome,
  RecurringRepairPreview,
  RecurringRepairField,
  RecurringTransactionDocument,
  ScheduleRule,
  TransactionRecurringProvenance,
} from "../types/recurring-transaction";
import type { RecurringProcessingStatusView } from "../types/recurring-processing-status";
import { RECURRING_COMMANDS } from "./registry";

const toBackendLocal = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

const toTotalOccurrences = (value: string | undefined): number | null =>
  value ? Number(value) : null;

export const getRecurringBudgetProjections = (input: {
  horizonMonths: number;
  includePausedBudgets?: boolean;
  focusRecurringTransactionId?: string;
}): CommandResult<BudgetProjectionResult> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_budget_projections, {
    horizonMonths: input.horizonMonths,
    includePausedBudgets: input.includePausedBudgets ?? false,
    focusRecurringTransactionId: input.focusRecurringTransactionId,
  });
};

export const buildScheduleRule = (
  values: Pick<
    RecurringFormValues,
    "scheduleKind" | "monthlyDay" | "intervalEvery" | "intervalUnit"
  >,
): ScheduleRule => {
  if (values.scheduleKind === "monthlyDay") {
    return {
      type: "monthlyDay",
      day: Number(values.monthlyDay),
    };
  }
  return {
    type: "interval",
    every: Number(values.intervalEvery),
    unit: values.intervalUnit,
  };
};

export const getRecurringTransactions = (
  limit = 50,
  cursor?: string,
  filters?: RecurringFeedFilters,
): CommandResult<RecurringFeedResult> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_transactions, {
    limit,
    cursor,
    filters,
  });
};

export const getRecurringTransaction = (
  recurringTransactionId: string,
): CommandResult<RecurringTransactionDocument> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_transaction, {
    recurringTransactionId,
  });
};

export const getRecurringTransactionOccurrences = (
  recurringTransactionId: string,
  limit = 50,
  cursor?: string,
): CommandResult<RecurringOccurrencePage> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_transaction_occurrences, {
    recurringTransactionId,
    limit,
    cursor,
  });
};

export const getTransactionRecurringProvenance = (
  transactionId: string,
): CommandResult<TransactionRecurringProvenance | null> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_transaction_recurring_provenance, {
    transactionId,
  });
};

export const createRecurringTransaction = (
  values: RecurringFormValues,
): CommandResult<RecurringCreateOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.create_recurring_transaction, {
    newRecurringTransaction: {
      schedule: buildScheduleRule(values),
      firstScheduledLocal: toBackendLocal(values.firstScheduledLocal),
      totalOccurrences: toTotalOccurrences(values.totalOccurrences),
      template: {
        description: values.description,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

export const previewRecurringAdoption = (
  transactionId: string,
  values: Pick<
    RecurringFormValues,
    "scheduleKind" | "monthlyDay" | "intervalEvery" | "intervalUnit" | "totalOccurrences"
  >,
): CommandResult<AdoptionPreview> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.preview_recurring_adoption, {
    request: {
      transactionId,
      schedule: buildScheduleRule(values),
      totalOccurrences: toTotalOccurrences(values.totalOccurrences),
    },
  });
};

export const adoptRecurringTransaction = (
  transaction: Transaction,
  values: RecurringFormValues,
): CommandResult<RecurringAdoptOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.adopt_recurring_transaction, {
    request: {
      transactionId: transaction.id,
      expectedTransactionDate: toBackendLocal(transaction.transactionDate),
      schedule: buildScheduleRule(values),
      totalOccurrences: toTotalOccurrences(values.totalOccurrences),
      template: {
        description: transaction.description?.trim() || "Recurring transaction",
        amount: transaction.amount,
        transactionType: transaction.transactionType === "income" ? "income" : "expense",
        transactionCategoryId: transaction.transactionCategoryId ?? null,
        notes: transaction.notes?.trim() || null,
      },
    },
  });
};

export const updateRecurringTransaction = (
  document: RecurringTransactionDocument,
  values: RecurringFormValues,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.update_recurring_transaction, {
    input: {
      recurringTransactionId: document.recurringTransaction.id,
      expectedRevision: document.recurringTransaction.revision,
      schedule: buildScheduleRule(values),
      nextScheduledLocal: toBackendLocal(values.firstScheduledLocal),
      totalOccurrences: toTotalOccurrences(values.totalOccurrences),
      template: {
        description: values.description,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

const lifecycleCommand = (
  command:
    | typeof RECURRING_COMMANDS.pause_recurring_transaction
    | typeof RECURRING_COMMANDS.resume_recurring_transaction
    | typeof RECURRING_COMMANDS.stop_recurring_transaction
    | typeof RECURRING_COMMANDS.delete_recurring_transaction,
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringLifecycleOutcome> => {
  return invokeDecodedCommand(command, {
    recurringTransactionId,
    expectedRevision,
  });
};

export const pauseRecurringTransaction = (
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringLifecycleOutcome> => {
  return lifecycleCommand(
    RECURRING_COMMANDS.pause_recurring_transaction,
    recurringTransactionId,
    expectedRevision,
  );
};

export const resumeRecurringTransaction = (
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringLifecycleOutcome> => {
  return lifecycleCommand(
    RECURRING_COMMANDS.resume_recurring_transaction,
    recurringTransactionId,
    expectedRevision,
  );
};

export const stopRecurringTransaction = (
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringLifecycleOutcome> => {
  return lifecycleCommand(
    RECURRING_COMMANDS.stop_recurring_transaction,
    recurringTransactionId,
    expectedRevision,
  );
};

export const deleteRecurringTransaction = (
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringLifecycleOutcome> => {
  return lifecycleCommand(
    RECURRING_COMMANDS.delete_recurring_transaction,
    recurringTransactionId,
    expectedRevision,
  );
};

export const getRecurringTransactionFailureHistory = (
  recurringTransactionId: string,
  limit = 20,
  cursor?: string,
): CommandResult<RecurringFailurePage> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_transaction_failure_history, {
    recurringTransactionId,
    limit,
    cursor,
  });
};

export const getRecurringGenerationFailureDiagnostics = (
  recurringTransactionId: string,
): CommandResult<GenerationFailureDiagnostics> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_generation_failure_diagnostics, {
    recurringTransactionId,
  });
};

export const previewRecurringGenerationRepair = (
  document: RecurringTransactionDocument,
  repairFieldKey: RecurringRepairField,
  values: Pick<
    RecurringFormValues,
    "description" | "amount" | "transactionType" | "transactionCategoryId" | "notes"
  >,
): CommandResult<RecurringRepairPreview> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.preview_recurring_generation_repair, {
    request: {
      recurringTransactionId: document.recurringTransaction.id,
      expectedRevision: document.recurringTransaction.revision,
      repairFieldKey,
      template: {
        description: values.description,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

export const repairRecurringGenerationFailure = (
  document: RecurringTransactionDocument,
  repairFieldKey: RecurringRepairField,
  values: Pick<
    RecurringFormValues,
    "description" | "amount" | "transactionType" | "transactionCategoryId" | "notes"
  >,
): CommandResult<RecurringRecoveryOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.repair_recurring_generation_failure, {
    input: {
      recurringTransactionId: document.recurringTransaction.id,
      expectedRevision: document.recurringTransaction.revision,
      repairFieldKey,
      template: {
        description: values.description,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

export const retryRecurringGenerationFailure = (
  recurringTransactionId: string,
  expectedRevision: number,
): CommandResult<RecurringRecoveryOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.retry_recurring_generation_failure, {
    input: {
      recurringTransactionId,
      expectedRevision,
    },
  });
};

export const getMatchingRecurringTransactionIds = (
  filters?: RecurringFeedFilters,
): CommandResult<RecurringMatchingIds> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_matching_recurring_transaction_ids, {
    filters,
  });
};

export const preflightRecurringBulk = (
  action: RecurringBulkAction,
  items: Array<RecurringBulkItem>,
): CommandResult<RecurringBulkPreflight> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.preflight_recurring_bulk, {
    request: { action, items },
  });
};

export const executeRecurringBulk = (
  action: RecurringBulkAction,
  items: Array<RecurringBulkItem>,
): CommandResult<RecurringBulkExecuteResult> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.execute_recurring_bulk, {
    request: { action, items },
  });
};

export const getRecurringProcessingStatus = (): CommandResult<RecurringProcessingStatusView> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_processing_status);
};
