import { Result } from "@praha/byethrow";

import type { CommandError } from "@/commands/errors";
import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type {
  AdoptRecurringFormValues,
  AdoptionPreview,
  RecurringAdoptOutcome,
  RecurringCreateOutcome,
  RecurringFeedResult,
  RecurringFormValues,
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
    RecurringFormValues,
    "scheduleKind" | "intervalEvery" | "intervalUnit" | "monthlyDay" | "firstScheduledLocal"
  >,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.edit_recurring_schedule, {
    input: {
      recurringTransactionId,
      expectedRevision,
      schedule: buildScheduleRule(values),
      nextScheduledLocal: toBackendLocal(values.firstScheduledLocal),
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

export const editRecurringTemplate = (
  recurringTransactionId: string,
  expectedRevision: number,
  values: Pick<
    RecurringFormValues,
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

export const adoptRecurringTransaction = (
  transactionId: string,
  values: AdoptRecurringFormValues,
): CommandResult<RecurringAdoptOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.adopt_recurring_transaction, {
    request: {
      transactionId,
      name: values.name,
      schedule: buildScheduleRule(values),
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

export const editRecurringCount = (
  recurringTransactionId: string,
  expectedRevision: number,
  values: Pick<RecurringFormValues, "totalMode" | "totalOccurrences">,
): CommandResult<RecurringMutationOutcome> => {
  return invokeDecodedCommand(RECURRING_COMMANDS.edit_recurring_count, {
    input: {
      recurringTransactionId,
      expectedRevision,
      totalOccurrences: values.totalMode === "finite" ? Number(values.totalOccurrences) : null,
    },
  });
};

export const updateRecurringTransaction = async (
  document: RecurringTransactionDocument,
  values: RecurringFormValues,
  configurationEditable: boolean,
): CommandResult<RecurringMutationOutcome> => {
  const id = document.recurringTransaction.id;
  let revision = document.recurringTransaction.revision;
  let latestDocument = document;
  let sawSucceeded = false;
  let sawAlreadyApplied = false;
  let unchangedReason: string | undefined;

  const apply = (
    result: Result.Result<RecurringMutationOutcome, CommandError>,
  ): Result.Result<RecurringMutationOutcome, CommandError> => {
    if (Result.isFailure(result)) {
      return result;
    }
    latestDocument = result.value.document;
    revision = latestDocument.recurringTransaction.revision;
    if (result.value.outcome === "succeeded") {
      sawSucceeded = true;
    } else if (result.value.outcome === "alreadyApplied") {
      sawAlreadyApplied = true;
    } else {
      unchangedReason = result.value.reason;
    }
    return result;
  };

  const renameResult = apply(await renameRecurringTransaction(id, revision, values.name));
  if (Result.isFailure(renameResult)) {
    return renameResult;
  }

  if (configurationEditable) {
    const scheduleResult = apply(await editRecurringSchedule(id, revision, values));
    if (Result.isFailure(scheduleResult)) {
      return scheduleResult;
    }

    const templateResult = apply(await editRecurringTemplate(id, revision, values));
    if (Result.isFailure(templateResult)) {
      return templateResult;
    }

    const countResult = apply(await editRecurringCount(id, revision, values));
    if (Result.isFailure(countResult)) {
      return countResult;
    }
  }

  if (sawSucceeded) {
    return Result.succeed({ outcome: "succeeded", document: latestDocument });
  }
  if (sawAlreadyApplied) {
    return Result.succeed({ outcome: "alreadyApplied", document: latestDocument });
  }
  return Result.succeed({
    outcome: "unchanged",
    document: latestDocument,
    reason: unchangedReason ?? "same_value",
  });
};
