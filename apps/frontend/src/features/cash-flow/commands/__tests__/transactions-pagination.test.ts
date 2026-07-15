import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";
import type * as SharedCommands from "@/commands/shared";

import { getAllTransactions } from "../transactions";

const invokeDecodedCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/commands/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedCommands>();
  return {
    ...actual,
    invokeDecodedCommand: invokeDecodedCommandMock,
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
    invokeDecodedCommandMock.mockReset();
  });

  it("loads every page without exceeding the backend page-size limit", async () => {
    invokeDecodedCommandMock.mockImplementation((descriptor, args) => {
      if (descriptor.name !== "get_transactions") {
        return Promise.resolve(Result.fail(new CommandError("unexpected command")));
      }

      const page = args?.page as number;
      const perPage = args?.perPage as number;

      if (perPage > 100) {
        return Promise.resolve(
          Result.fail(
            new CommandError(
              "Failed to load transactions: Invalid data: Transaction list page must be at least 1 and page size must be between 1 and 100",
            ),
          ),
        );
      }

      return Promise.resolve(Result.succeed(transactionPage(page, perPage)));
    });

    const result = await getAllTransactions();

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) {
      return;
    }
    expect(result.value).toHaveLength(2);
    expect(invokeDecodedCommandMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: "get_transactions" }),
      {
        page: 1,
        perPage: 100,
        filters: null,
        sort: null,
      },
    );
    expect(invokeDecodedCommandMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: "get_transactions" }),
      {
        page: 2,
        perPage: 100,
        filters: null,
        sort: null,
      },
    );
  });
});
