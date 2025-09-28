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

export const getTransactionCategory = async (
  category_id: string
): Promise<TransactionCategory> => {
  try {
    const result = await invokeTauri("get_transaction_category", {
      category_id: category_id,
    });
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
      newCategory: category,
    });
    return TransactionCategorySchema.parse(result);
  } catch (error) {
    logger.error(
      "Error creating transaction category " + JSON.stringify(error)
    );
    throw error;
  }
};

export const updateTransactionCategory = async (
  category: NewTransactionCategory
): Promise<TransactionCategory> => {
  try {
    const result = await invokeTauri("update_transaction_category", {
      updatedCategory: category,
    });
    return TransactionCategorySchema.parse(result);
  } catch (error) {
    logger.error(
      "Error updating transaction category: " + JSON.stringify(error)
    );
    throw error;
  }
};

export const deleteTransactionCategory = async (
  category_id: string
): Promise<TransactionCategory> => {
  try {
    const result = await invokeTauri("delete_transaction_category", {
      category_id: category_id,
    });
    return TransactionCategorySchema.parse(result);
  } catch (error) {
    logger.error("Error deleting transaction category");
    throw error;
  }
};

export const deleteTransactionCategories = async (
  category_ids: ReadonlyArray<string>
): Promise<TransactionCategories> => {
  try {
    const result = await invokeTauri("delete_transaction_categories", {
      categoryIds: category_ids,
    });
    return TransactionCategoriesSchema.parse(result);
  } catch (error) {
    logger.error(
      "Error deleting transaction categories: " + JSON.stringify(error)
    );
    throw error;
  }
};
