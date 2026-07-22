import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type {
  AdoptRecurringFormValues,
  AdoptionPreview,
  RecurringAdoptOutcome,
  RecurringCreateOutcome,
  RecurringFeedResult,
  RecurringFormValues,
  RecurringLifecycleOutcome,
  RecurringMutationOutcome,
  RecurringOccurrencePage,
  RecurringTransactionDocument,
  ScheduleRule,
  TransactionRecurringProvenance,
} from "../types/recurring-transaction";
import { RECURRING_COMMANDS } from "./registry";

const toBackendLocal = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

export const buildScheduleRule = (
  values: Pick<
    RecurringFormValues | AdoptRecurringFormValues,
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
): CommandResult<RecurringFeedResult> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.get_recurring_transactions, {
    limit,
    ...(cursor ? { cursor } : {}),
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
    ...(cursor ? { cursor } : {}),
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
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
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
  values: AdoptRecurringFormValues,
): CommandResult<AdoptionPreview> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.preview_recurring_adoption, {
    request: {
      transactionId,
      schedule: buildScheduleRule(values),
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
    },
  });
};

export const adoptRecurringTransaction = (
  transactionId: string,
  values: AdoptRecurringFormValues,
): CommandResult<RecurringAdoptOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.adopt_recurring_transaction, {
    request: {
      transactionId,
      schedule: buildScheduleRule(values),
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
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
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
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
