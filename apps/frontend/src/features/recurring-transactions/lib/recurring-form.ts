import { defaultFirstScheduledLocal } from "./recurring";
import type { RecurringFormMode } from "../types/recurring-form-mode";
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

export const createRecurringFormDefaults = (): RecurringFormInput => ({
  name: "",
  scheduleKind: "interval",
  intervalEvery: "1",
  intervalUnit: "month",
  monthlyDay: "1",
  firstScheduledLocal: defaultFirstScheduledLocal(),
  totalMode: "indefinite",
  totalOccurrences: "",
  description: "",
  amount: "",
  transactionType: "expense",
  transactionCategoryId: undefined,
  notes: "",
});

export const defaultsFromDocument = (
  document: RecurringTransactionDocument,
): RecurringFormInput => {
  const { recurringTransaction, schedule, template, occurrenceSummary } = document;
  const scheduleKind = schedule.rule.type === "monthlyDay" ? "monthlyDay" : "interval";
  return {
    name: recurringTransaction.name,
    scheduleKind,
    intervalEvery: schedule.rule.type === "interval" ? String(schedule.rule.every) : "1",
    intervalUnit: schedule.rule.type === "interval" ? schedule.rule.unit : "month",
    monthlyDay: schedule.rule.type === "monthlyDay" ? String(schedule.rule.day) : "1",
    firstScheduledLocal: toLocalInputValue(
      occurrenceSummary.nextScheduledLocal ?? schedule.firstScheduledLocal,
    ),
    totalMode: recurringTransaction.totalOccurrences == null ? "indefinite" : "finite",
    totalOccurrences:
      recurringTransaction.totalOccurrences == null
        ? ""
        : String(recurringTransaction.totalOccurrences),
    description: template.description ?? "",
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
  return createRecurringFormDefaults();
};

export const getRecurringFormCopy = (mode: RecurringFormMode) => {
  if (mode.type === "edit") {
    return {
      title: "Edit recurring transaction",
      description:
        "Update the name, schedule, template, and count. Future occurrences use these values; fulfilled history stays unchanged.",
      submitLabel: "Save changes",
      submittingLabel: "Saving...",
      successMessage: "Recurring transaction updated",
    };
  }
  return {
    title: "New recurring transaction",
    description:
      "Name the recurring transaction, set its schedule and future transaction template, then choose an indefinite or finite total.",
    submitLabel: "Create recurring transaction",
    submittingLabel: "Creating...",
    successMessage: "Recurring transaction created",
  };
};
