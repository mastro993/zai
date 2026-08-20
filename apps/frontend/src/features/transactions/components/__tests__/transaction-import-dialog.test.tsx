// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as currencyCommands from "@/features/currency/commands/currency";
import * as currencyEvents from "@/features/currency/commands/currency-state-events";
import { CurrencyBootstrapProvider } from "@/features/currency/hooks/use-currency-bootstrap";

import * as transactionImport from "../../commands/transaction-import";
import * as transactionImportDigest from "../../lib/transaction-import-digest";
import { TransactionImportDialog } from "../transaction-import-dialog";

describe("TransactionImportDialog", () => {
  beforeEach(() => {
    vi.spyOn(currencyEvents, "createCurrencyStateEventTransport").mockImplementation(() => ({
      subscribe: (_onEvent, _onReconnect) => ({
        ready: Promise.resolve(Result.succeed(undefined)),
        close: () => undefined,
      }),
    }));
    vi.spyOn(currencyCommands, "getCurrencyBootstrap").mockResolvedValue(
      Result.succeed({ setupComplete: true, defaultCurrency: "EUR" }),
    );
    vi.spyOn(currencyCommands, "getSupportedCurrencies").mockResolvedValue(
      Result.succeed([{ code: "EUR", name: "Euro" }]),
    );
    vi.spyOn(currencyCommands, "getCurrencyStatus").mockResolvedValue(
      Result.succeed({ job: null }),
    );
    vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(
      Result.succeed([
        {
          code: "EUR",
          name: "Euro",
          status: "enabled",
          coverageFrom: null,
          coverageTo: null,
          lastRefresh: null,
          refreshStatus: "idle",
          missingPeriods: [],
          usedByRecurring: false,
          isDefault: true,
        },
      ]),
    );
    vi.spyOn(transactionImport, "openTransactionImportFile").mockResolvedValue(
      Result.succeed({
        name: "currencyless.csv",
        content: "date,amount,type,description\n2026-08-18,10.00,expense,Coffee\n",
      }),
    );
    vi.spyOn(transactionImportDigest, "digestTransactionImportFile").mockResolvedValue(
      Result.succeed("digest"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clears the previous CSV when the wizard reopens", async () => {
    const view = render(
      <CurrencyBootstrapProvider>
        <TransactionImportDialog
          open
          categories={[]}
          onOpenChange={() => undefined}
          onImported={async () => undefined}
        />
      </CurrencyBootstrapProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Select a CSV file/ }));
    await waitFor(() => expect(screen.getByText("currencyless.csv")).toBeTruthy());

    view.rerender(
      <CurrencyBootstrapProvider>
        <TransactionImportDialog
          open={false}
          categories={[]}
          onOpenChange={() => undefined}
          onImported={async () => undefined}
        />
      </CurrencyBootstrapProvider>,
    );
    view.rerender(
      <CurrencyBootstrapProvider>
        <TransactionImportDialog
          open
          categories={[]}
          onOpenChange={() => undefined}
          onImported={async () => undefined}
        />
      </CurrencyBootstrapProvider>,
    );

    expect(await screen.findByRole("button", { name: /Select a CSV file/ })).toBeTruthy();
    expect(screen.queryByText("currencyless.csv")).toBeNull();
  });
});
