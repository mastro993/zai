import { invokeTauri, logger } from "@/lib/adapters";
import {
  NewTransactionCategory,
  TransactionCategories,
  TransactionCategoriesSchema,
  TransactionCategory,
  TransactionCategorySchema,
} from "./types";

export const getTransactionCategories =
  async (): Promise<TransactionCategories> => {
    try {
      const result = await invokeTauri("get_transaction_categories");
      return TransactionCategoriesSchema.parse(result);
    } catch (error) {
      logger.error("Error fetching transaction categories");
      throw error;
    }
  };

export const getTransactionCategory =
  async (): Promise<TransactionCategory> => {
    try {
      const result = await invokeTauri("get_transaction_category");
      return TransactionCategorySchema.parse(result);
    } catch (error) {
      logger.error("Error fetching transaction category");
      throw error;
    }
  };

export const importTransactionCategories = async (
  categories: ReadonlyArray<NewTransactionCategory>
): Promise<TransactionCategories> => {
  try {
    const result = await invokeTauri("import_transaction_categories", {
      categories: categories,
    });
    return TransactionCategoriesSchema.parse(result);
  } catch (error) {
    logger.error("Error fetching transaction categories");
    throw error;
  }
};

export const createTransactionCategory = async (
  category: NewTransactionCategory
): Promise<TransactionCategory> => {
  try {
    const result = await invokeTauri("create_transaction_category", {
      new_category: category,
    });
    return TransactionCategorySchema.parse(result);
  } catch (error) {
    logger.error("Error creating transaction category");
    throw error;
  }
};
