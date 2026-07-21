import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type {
  RecurringCreateOutcome,
  RecurringEditFormValues,
  RecurringFeedResult,
  RecurringFormValues,
  RecurringMutationOutcome,
  RecurringTransactionDocument,
  ScheduleRule,
} from "../types/recurring-transaction";
import { RECURRING_COMMANDS } from "./registry";

const toBackendLocal = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

export const buildScheduleRule = (values: {
  scheduleKind: "interval" | "monthlyDay";
  intervalEvery: string;
  intervalUnit: "day" | "week" | "month" | "year";
  monthlyDay: string;
}): ScheduleRule => {
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

export const createRecurringTransaction = (
  values: RecurringFormValues,
): CommandResult<RecurringCreateOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.create_recurring_transaction, {
    newRecurringTransaction: {
      name: values.name,
      schedule: buildScheduleRule(values),
      firstScheduledLocal: toBackendLocal(values.firstScheduledLocal),
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
      template: {
        description: values.description || null,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

export const renameRecurringTransaction = (
  recurringTransactionId: string,
  expectedRevision: number,
  name: string,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.rename_recurring_transaction, {
    input: {
      recurringTransactionId,
      expectedRevision,
      name,
    },
  });
};

export const editRecurringSchedule = (
  recurringTransactionId: string,
  expectedRevision: number,
  values: Pick<
    RecurringEditFormValues,
    "scheduleKind" | "intervalEvery" | "intervalUnit" | "monthlyDay" | "nextScheduledLocal"
  >,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.edit_recurring_schedule, {
    input: {
      recurringTransactionId,
      expectedRevision,
      schedule: buildScheduleRule(values),
      nextScheduledLocal: toBackendLocal(values.nextScheduledLocal),
    },
  });
};

export const editRecurringTemplate = (
  recurringTransactionId: string,
  expectedRevision: number,
  values: Pick<
    RecurringEditFormValues,
    "description" | "amount" | "transactionType" | "transactionCategoryId" | "notes"
  >,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.edit_recurring_template, {
    input: {
      recurringTransactionId,
      expectedRevision,
      template: {
        description: values.description || null,
        amount: values.amount,
        transactionType: values.transactionType,
        transactionCategoryId: values.transactionCategoryId || null,
        notes: values.notes || null,
      },
    },
  });
};

export const editRecurringCount = (
  recurringTransactionId: string,
  expectedRevision: number,
  values: Pick<RecurringEditFormValues, "totalMode" | "totalOccurrences">,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.edit_recurring_count, {
    input: {
      recurringTransactionId,
      expectedRevision,
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
    },
  });
};
