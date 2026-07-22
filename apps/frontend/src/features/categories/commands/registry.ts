import { z } from "zod";

import type { CommandDescriptor } from "@/commands/command-descriptor";

import { categoryDeletionPreviewSchema, categorySchema } from "../types/model";

const categoryArraySchema = z.array(categorySchema);

const backendCommand = <T>(
  name: string,
  resultSchema: CommandDescriptor<T>["resultSchema"],
): CommandDescriptor<T> => ({
  name,
  transport: "backend",
  resultSchema,
  webMapped: true,
});

export const CATEGORY_COMMANDS = {
  get_transaction_category: backendCommand("get_transaction_category", categorySchema),
  get_transaction_categories: backendCommand("get_transaction_categories", categoryArraySchema),
  create_transaction_category: backendCommand("create_transaction_category", categorySchema),
  update_transaction_category: backendCommand("update_transaction_category", categorySchema),
  delete_transaction_categories: backendCommand(
    "delete_transaction_categories",
    categoryArraySchema,
  ),
  preview_delete_transaction_categories: backendCommand(
    "preview_delete_transaction_categories",
    categoryDeletionPreviewSchema,
  ),
  import_transaction_categories: backendCommand(
    "import_transaction_categories",
    categoryArraySchema,
  ),
} as const;

export const CATEGORY_BACKEND_COMMANDS = Object.values(
  CATEGORY_COMMANDS,
) as Array<CommandDescriptor>;
