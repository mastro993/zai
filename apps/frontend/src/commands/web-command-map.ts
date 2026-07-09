import { CommandError } from "./errors";
import type { CommandArgs } from "./types";

const defaultApiBaseUrl = "http://127.0.0.1:3000/api/cash-flow";

export type WebRequestSpec = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
};

const readString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const readStringArray = (value: unknown): Array<string> | undefined => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }

  return value;
};

const omitId = (payload: Record<string, unknown>): Record<string, unknown> => {
  const { id: _id, ...rest } = payload;
  return rest;
};

export const resolveWebApiBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_ZAI_API_BASE_URL;
  return typeof configuredBaseUrl === "string" && configuredBaseUrl.length > 0
    ? configuredBaseUrl
    : defaultApiBaseUrl;
};

export const buildWebRequestSpec = (command: string, args: CommandArgs = {}): WebRequestSpec => {
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
      throw new CommandError(`Unknown web command: ${command}`);
  }
};

export const buildWebRequestUrl = (baseUrl: string, spec: WebRequestSpec): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = spec.path.startsWith("/") ? spec.path : `/${spec.path}`;
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`);
  if (spec.query) {
    for (const [key, value] of Object.entries(spec.query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};
