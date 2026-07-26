import { z } from "zod";

import { createCommandDescriptor, type CommandDescriptor } from "@/commands/command-descriptor";

import { categoryDeletionPreviewSchema, categorySchema } from "../types/model";
import {
  buildCreateCategoryRequest,
  buildDeleteCategoriesRequest,
  buildGetCategoriesRequest,
  buildGetCategoryRequest,
  buildImportCategoriesRequest,
  buildPreviewDeleteCategoriesRequest,
  buildUpdateCategoryRequest,
} from "./web-requests";

const categoryArraySchema = z.array(categorySchema);

const backendCommand = <TArgs, T>(
  name: string,
  resultSchema: z.ZodType<T>,
  webRequest: Parameters<typeof createCommandDescriptor<TArgs, T>>[2],
): CommandDescriptor<TArgs, T> => createCommandDescriptor(name, resultSchema, webRequest);

export const CATEGORY_COMMANDS = {
  get_transaction_category: backendCommand(
    "get_transaction_category",
    categorySchema,
    buildGetCategoryRequest,
  ),
  get_transaction_categories: backendCommand(
    "get_transaction_categories",
    categoryArraySchema,
    buildGetCategoriesRequest,
  ),
  create_transaction_category: backendCommand(
    "create_transaction_category",
    categorySchema,
    buildCreateCategoryRequest,
  ),
  update_transaction_category: backendCommand(
    "update_transaction_category",
    categorySchema,
    buildUpdateCategoryRequest,
  ),
  delete_transaction_categories: backendCommand(
    "delete_transaction_categories",
    categoryArraySchema,
    buildDeleteCategoriesRequest,
  ),
  preview_delete_transaction_categories: backendCommand(
    "preview_delete_transaction_categories",
    categoryDeletionPreviewSchema,
    buildPreviewDeleteCategoriesRequest,
  ),
  import_transaction_categories: backendCommand(
    "import_transaction_categories",
    categoryArraySchema,
    buildImportCategoriesRequest,
  ),
} as const;

export const CATEGORY_BACKEND_COMMANDS = Object.values(
  CATEGORY_COMMANDS,
) as unknown as Array<CommandDescriptor>;
