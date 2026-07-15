import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

import { getAllTransactions } from "../transactions";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/commands/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/commands/shared")>();
  return {
    ...actual,
    invokeCommand: invokeCommandMock,
  };
});

const transactionPage = (page: number, perPage: number) => ({
  data: [
    {
      id: `transaction-${page}`,
      description: null,
      amount: 1000,
      transactionDate: "2026-01-15T12:00:00",
      transactionType: "expense",
      transactionCategoryId: null,
      notes: null,
    },
  ],
  page,
  perPage,
  totalPages: 2,
});

describe("getAllTransactions", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("loads every page without exceeding the backend page-size limit", async () => {
    invokeCommandMock.mockImplementation(
      (_command: string, args: { page: number; perPage: number }) => {
        if (args.perPage > 100) {
          return Promise.resolve(
            Result.fail(
              new CommandError(
                "Failed to load transactions: Invalid data: Transaction list page must be at least 1 and page size must be between 1 and 100",
              ),
            ),
          );
        }

        return Promise.resolve(Result.succeed(transactionPage(args.page, args.perPage)));
      },
    );

    const result = await getAllTransactions();

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toHaveLength(2);
    expect(invokeCommandMock).toHaveBeenNthCalledWith(1, "get_transactions", {
      page: 1,
      perPage: 100,
      filters: null,
      sort: null,
    });
    expect(invokeCommandMock).toHaveBeenNthCalledWith(2, "get_transactions", {
      page: 2,
      perPage: 100,
      filters: null,
      sort: null,
    });
  });
});
