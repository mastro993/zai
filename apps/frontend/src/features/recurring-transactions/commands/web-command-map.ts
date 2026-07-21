import type { CommandArgs } from "@/commands/types";
import { readNumber, readRecord, readString } from "@/commands/web-request-args";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const buildRecurringCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "get_recurring_transactions": {
      const limit = readNumber(args.limit, 50);
      const cursor = readString(args.cursor);
      return {
        method: "GET",
        path: "/recurring-transactions",
        query: {
          limit: String(limit),
          ...(cursor ? { cursor } : {}),
        },
      };
    }
    case "get_recurring_transaction": {
      const recurringTransactionId = readString(args.recurringTransactionId);
      return {
        method: "GET",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}`
          : "/recurring-transactions/__missing_recurring_transaction_id__",
      };
    }
    case "get_recurring_transaction_occurrences": {
      const recurringTransactionId = readString(args.recurringTransactionId);
      const limit = readNumber(args.limit, 50);
      const cursor = readString(args.cursor);
      return {
        method: "GET",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}/occurrences`
          : "/recurring-transactions/__missing_recurring_transaction_id__/occurrences",
        query: {
          limit: String(limit),
          ...(cursor ? { cursor } : {}),
        },
      };
    }
    case "get_transaction_recurring_provenance": {
      const transactionId = readString(args.transactionId);
      return {
        method: "GET",
        path: transactionId
          ? `/recurring-transactions/provenance/${transactionId}`
          : "/recurring-transactions/provenance/__missing_transaction_id__",
      };
    }
    case "create_recurring_transaction": {
      const newRecurringTransaction = readRecord(args.newRecurringTransaction);
      return {
        method: "POST",
        path: "/recurring-transactions",
        body: newRecurringTransaction ?? {},
      };
    }
    case "adopt_recurring_transaction": {
      const request = readRecord(args.request);
      return {
        method: "POST",
        path: "/recurring-transactions/adopt",
        body: request ?? {},
      };
    }
    case "edit_recurring_count": {
      const input = readRecord(args.input) ?? {};
      const recurringTransactionId = readString(input.recurringTransactionId);
      return {
        method: "POST",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}/count`
          : "/recurring-transactions/__missing_recurring_transaction_id__/count",
        body: input,
      };
    }
    case "edit_recurring_schedule": {
      const input = readRecord(args.input) ?? {};
      const recurringTransactionId = readString(input.recurringTransactionId);
      return {
        method: "POST",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}/schedule`
          : "/recurring-transactions/__missing_recurring_transaction_id__/schedule",
        body: input,
      };
    }
    case "edit_recurring_template": {
      const input = readRecord(args.input) ?? {};
      const recurringTransactionId = readString(input.recurringTransactionId);
      return {
        method: "POST",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}/template`
          : "/recurring-transactions/__missing_recurring_transaction_id__/template",
        body: input,
      };
    }
    case "preview_recurring_adoption": {
      const request = readRecord(args.request);
      return {
        method: "POST",
        path: "/recurring-transactions/adoption-preview",
        body: request ?? {},
      };
    }
    case "rename_recurring_transaction": {
      const input = readRecord(args.input) ?? {};
      const recurringTransactionId = readString(input.recurringTransactionId);
      return {
        method: "POST",
        path: recurringTransactionId
          ? `/recurring-transactions/${recurringTransactionId}/rename`
          : "/recurring-transactions/__missing_recurring_transaction_id__/rename",
        body: input,
      };
    }
    default:
      return undefined;
  }
};
