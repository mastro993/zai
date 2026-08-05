import { defaultFirstScheduledLocal } from "./recurring";
import type { RecurringFormMode } from "../types/recurring-form-mode";
import type { Transaction } from "@/features/transactions/types/model";
import { SCHEDULE_INTERVAL_UNITS } from "../types/recurring-transaction";
import type {
  RecurringFormInput,
  RecurringTransactionDocument,
} from "../types/recurring-transaction";

export const toLocalInputValue = (value: string | null | undefined): string => {
  if (!value) {
    return defaultFirstScheduledLocal();
  }
  return value.length >= 16 ? value.slice(0, 16) : value;
};

export const getScheduleIntervalUnitItems = (every: string | undefined) =>
  SCHEDULE_INTERVAL_UNITS.map((unit) => ({
    value: unit,
    label: Number(every) === 1 ? unit : `${unit}s`,
  }));

export const formatRecurringOrdinal = (value: number) => {
  const lastTwoDigits = value % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : value % 10 === 1
        ? "st"
        : value % 10 === 2
          ? "nd"
          : value % 10 === 3
            ? "rd"
            : "th";
  return `${value}${suffix}`;
};

export const createRecurringFormDefaults = (): RecurringFormInput => ({
  scheduleKind: "interval",
  intervalEvery: "1",
  intervalUnit: "month",
  monthlyDay: "1",
  firstScheduledLocal: defaultFirstScheduledLocal(),
  totalOccurrences: "",
  description: "",
  amount: "",
  transactionType: "expense",
  transactionCategoryId: undefined,
  notes: "",
});

export const defaultsFromTransaction = (transaction: Transaction): RecurringFormInput => ({
  scheduleKind: "interval",
  intervalEvery: "1",
  intervalUnit: "month",
  monthlyDay: "1",
  firstScheduledLocal: toLocalInputValue(transaction.transactionDate),
  totalOccurrences: "",
  description: transaction.description?.trim() ?? "",
  amount: (transaction.amount / 100).toFixed(2),
  transactionType: transaction.transactionType === "income" ? "income" : "expense",
  transactionCategoryId: transaction.transactionCategoryId ?? undefined,
  notes: transaction.notes?.trim() ?? "",
});

export const defaultsFromDocument = (
  document: RecurringTransactionDocument,
): RecurringFormInput => {
  const { recurringTransaction, schedule, template, occurrenceSummary } = document;
  const scheduleKind = schedule.rule.type === "monthlyDay" ? "monthlyDay" : "interval";
  return {
    scheduleKind,
    intervalEvery: schedule.rule.type === "interval" ? String(schedule.rule.every) : "1",
    intervalUnit: schedule.rule.type === "interval" ? schedule.rule.unit : "month",
    monthlyDay: schedule.rule.type === "monthlyDay" ? String(schedule.rule.day) : "1",
    firstScheduledLocal: toLocalInputValue(
      occurrenceSummary.nextScheduledLocal ?? schedule.firstScheduledLocal,
    ),
    totalOccurrences:
      recurringTransaction.totalOccurrences == null
        ? ""
        : String(recurringTransaction.totalOccurrences),
    description: template.description,
    amount: (template.amount / 100).toFixed(2),
    transactionType: template.transactionType,
    transactionCategoryId: template.transactionCategoryId ?? undefined,
    notes: template.notes ?? "",
  };
};

export const getRecurringFormDefaults = (mode: RecurringFormMode): RecurringFormInput => {
  if (mode.type === "edit") {
    return defaultsFromDocument(mode.document);
  }
  if (mode.type === "adopt") {
    return defaultsFromTransaction(mode.transaction);
  }
  return createRecurringFormDefaults();
};

export const getRecurringFormCopy = (mode: RecurringFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit recurring transaction",
      description:
        "Update the description, schedule, template, and count. Future occurrences use these values; fulfilled history stays unchanged.",
      submitLabel: "Save changes",
      submittingLabel: "Saving...",
      successMessage: "Recurring transaction updated",
    };
  }
  if (mode.type === "adopt") {
    return {
      title: "Adopt as recurring",
      description:
        "This transaction becomes occurrence 1. Choose the schedule and total occurrences.",
      submitLabel: "Confirm adoption",
      submittingLabel: "Adopting...",
      successMessage: "Recurring transaction adopted",
    };
  }
  return {
    title: "New recurring transaction",
    description: "Record a recurring income or expense",
    submitLabel: "Create recurring transaction",
    submittingLabel: "Creating...",
    successMessage: "Recurring transaction created",
  };
};
