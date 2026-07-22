import { CommandError } from "@/commands/errors";
import type { CommandArgs } from "@/commands/types";
import { omitId, readRecord, readString, readStringArray } from "@/commands/web-request-args";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const buildCategoryCommandRequestSpec = (
  command: string,
  args: CommandArgs = {},
): WebRequestSpec | undefined => {
  switch (command) {
    case "get_transaction_categories": {
      const parentId = readString(args.parentId);
      return {
        method: "GET",
        path: "/categories",
        query: parentId ? { parentId } : undefined,
      };
    }
    case "get_transaction_category": {
      const categoryId = readString(args.categoryId);
      if (!categoryId) {
        throw new CommandError("get_transaction_category requires categoryId");
      }
      return {
        method: "GET",
        path: `/categories/${categoryId}`,
      };
    }
    case "create_transaction_category": {
      const newCategory = readRecord(args.newCategory);
      if (!newCategory) {
        throw new CommandError("create_transaction_category requires newCategory");
      }
      return {
        method: "POST",
        path: "/categories",
        body: newCategory,
      };
    }
    case "update_transaction_category": {
      const updatedCategory = readRecord(args.updatedCategory);
      const categoryId = readString(updatedCategory?.id);
      if (!updatedCategory || !categoryId) {
        throw new CommandError("update_transaction_category requires updatedCategory.id");
      }
      return {
        method: "PUT",
        path: `/categories/${categoryId}`,
        body: omitId(updatedCategory),
      };
    }
    case "delete_transaction_categories": {
      const categoryIds = readStringArray(args.categoryIds);
      if (!categoryIds) {
        throw new CommandError("delete_transaction_categories requires categoryIds");
      }
      return {
        method: "POST",
        path: "/categories/bulk-delete",
        body: {
          categoryIds,
          ...(args.childrenStrategy ? { childrenStrategy: args.childrenStrategy } : {}),
          ...(args.confirmBudgetImpact ? { confirmBudgetImpact: true } : {}),
        },
      };
    }
    case "preview_delete_transaction_categories": {
      const categoryIds = readStringArray(args.categoryIds);
      if (!categoryIds) {
        throw new CommandError("preview_delete_transaction_categories requires categoryIds");
      }
      return {
        method: "POST",
        path: "/categories/bulk-delete/preview",
        body: {
          categoryIds,
          ...(args.childrenStrategy ? { childrenStrategy: args.childrenStrategy } : {}),
        },
      };
    }
    case "import_transaction_categories": {
      const categories = args.categories;
      if (!Array.isArray(categories)) {
        throw new CommandError("import_transaction_categories requires categories");
      }
      return {
        method: "POST",
        path: "/categories/import",
        body: { categories },
      };
    }
    default:
      return undefined;
  }
};
