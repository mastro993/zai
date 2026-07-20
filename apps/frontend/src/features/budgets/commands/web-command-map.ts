import type { CommandArgs } from "@/commands/types";
import { readNumber, readRecord, readString } from "@/commands/web-request-args";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const buildBudgetCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "get_budgets": {
      const filter = readString(args.filter);
      return {
        method: "GET",
        path: "/budgets",
        query: filter ? { filter } : undefined,
      };
    }
    case "get_budget": {
      const budgetId = readString(args.budgetId);
      if (!budgetId) {
        return {
          method: "GET",
          path: "/budgets/__missing_budget_id__",
        };
      }
      return {
        method: "GET",
        path: `/budgets/${budgetId}`,
      };
    }
    case "get_budget_history": {
      const budgetId = readString(args.budgetId);
      if (!budgetId) {
        return {
          method: "GET",
          path: "/budgets/__missing_budget_id__/history",
        };
      }
      const page = readNumber(args.page, 1);
      const perPage = readNumber(args.perPage, 50);
      return {
        method: "GET",
        path: `/budgets/${budgetId}/history?page=${page}&perPage=${perPage}`,
      };
    }
    case "create_budget": {
      const newBudget = readRecord(args.newBudget);
      if (!newBudget) {
        return {
          method: "POST",
          path: "/budgets",
          body: {},
        };
      }
      return {
        method: "POST",
        path: "/budgets",
        body: newBudget,
      };
    }
    case "update_budget": {
      const budgetId = readString(args.budgetId);
      const updatedBudget = readRecord(args.updatedBudget);
      if (!budgetId || !updatedBudget) {
        return {
          method: "PUT",
          path: "/budgets/__missing_budget_id__",
          body: updatedBudget ?? {},
        };
      }
      return {
        method: "PUT",
        path: `/budgets/${budgetId}`,
        body: updatedBudget,
      };
    }
    case "delete_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "DELETE",
        path: budgetId ? `/budgets/${budgetId}` : "/budgets/__missing_budget_id__",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    case "pause_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "POST",
        path: budgetId ? `/budgets/${budgetId}/pause` : "/budgets/__missing_budget_id__/pause",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    case "resume_budget": {
      const budgetId = readString(args.budgetId);
      return {
        method: "POST",
        path: budgetId ? `/budgets/${budgetId}/resume` : "/budgets/__missing_budget_id__/resume",
        body: { expectedRevision: readNumber(args.expectedRevision, -1) },
      };
    }
    default:
      return undefined;
  }
};
