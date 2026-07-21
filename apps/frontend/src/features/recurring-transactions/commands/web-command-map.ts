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
    case "create_recurring_transaction": {
      const newRecurringTransaction = readRecord(args.newRecurringTransaction);
      return {
        method: "POST",
        path: "/recurring-transactions",
        body: newRecurringTransaction ?? {},
      };
    }
    default:
      return undefined;
  }
};
