// @vitest-environment jsdom

import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";

import * as currencyCommands from "@/features/currency/commands/currency";
import * as currencyEvents from "@/features/currency/commands/currency-state-events";
import { CurrencyBootstrapProvider } from "@/features/currency/hooks/use-currency-bootstrap";
import {
  resetLastUsedTransactionCurrency,
  setLastUsedTransactionCurrency,
} from "../../lib/last-used-currency";
import { sampleTransaction } from "../../types/sample";
import { TransactionFormDrawer } from "../transaction-form-drawer";

const currencies = [
  {
    code: "EUR",
    name: "Euro",
    status: "enabled" as const,
    coverageFrom: null,
    coverageTo: null,
    lastRefresh: null,
    refreshStatus: "idle" as const,
    missingPeriods: [],
    usedByRecurring: false,
    isDefault: true,
  },
  {
    code: "USD",
    name: "US Dollar",
    status: "enabled" as const,
    coverageFrom: null,
    coverageTo: null,
    lastRefresh: null,
    refreshStatus: "idle" as const,
    missingPeriods: [],
    usedByRecurring: false,
    isDefault: false,
  },
];

const stubCurrencyBootstrap = () => {
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
    Result.succeed([
      { code: "EUR", name: "Euro" },
      { code: "USD", name: "US Dollar" },
    ]),
  );
  vi.spyOn(currencyCommands, "getCurrencyStatus").mockResolvedValue(Result.succeed({ job: null }));
  vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(Result.succeed(currencies));
  vi.spyOn(currencyCommands, "getTransactionExchangeRateQuote").mockResolvedValue(
    Result.succeed({
      sourceCurrency: "USD",
      targetCurrency: "EUR",
      rateDate: "2026-07-09",
      variant: "automatic",
      rate: "0.92",
      attribution: "ECB",
      complete: true,
    }),
  );
};

const renderForm = async () => {
  const view = render(
    <CurrencyBootstrapProvider>
      <Drawer open swipeDirection="right">
        <TransactionFormDrawer
          mode={{ type: "create" }}
          categories={[]}
          onSubmit={vi.fn().mockResolvedValue(undefined)}
        />
      </Drawer>
    </CurrencyBootstrapProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText("Amount")).toBeTruthy());
  return view;
};

afterEach(() => {
  cleanup();
  resetLastUsedTransactionCurrency();
  vi.restoreAllMocks();
});

describe("TransactionFormDrawer", () => {
  beforeEach(() => {
    stubCurrencyBootstrap();
  });

  it("distinguishes expense and income with directional semantic icons", async () => {
    await renderForm();

    const typeGroup = screen.getByRole("group", { name: "Transaction type" });
    const expense = within(typeGroup).getByRole("button", { name: "expense" });
    const income = within(typeGroup).getByRole("button", { name: "income" });

    expect(expense.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(income.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
    expect(expense.querySelector("svg")?.classList.contains("text-destructive")).toBe(true);
    expect(income.querySelector("svg")?.classList.contains("text-primary")).toBe(true);
  });

  it("does not show redundant date helper text", async () => {
    await renderForm();

    expect(screen.queryByText("Date and time when the transaction occurred.")).toBeNull();
  });

  it("uses minute precision for native time editing", async () => {
    await renderForm();

    expect(screen.getByText("Date and time")).toBeDefined();
    const timeInput = document.getElementById("transaction-time");
    expect(timeInput).not.toBeNull();
    expect(timeInput).toHaveProperty("type", "time");
    expect(timeInput?.getAttribute("data-slot")).toBe("input-group-control");
    expect(timeInput?.getAttribute("step")).toBe("60");
    expect(timeInput?.classList.contains("appearance-none")).toBe(true);
    expect(timeInput?.classList.contains("[&::-webkit-calendar-picker-indicator]:hidden")).toBe(
      true,
    );
    const timeGroup = timeInput?.closest('[data-slot="input-group"]');
    expect(timeGroup).not.toBeNull();
    expect(timeGroup?.querySelector("svg[data-icon='inline-start']")).not.toBeNull();
  });

  it("shows the transaction currency as an amount suffix and preselects the default", async () => {
    await renderForm();

    expect(screen.getByLabelText("Transaction currency")).toBeTruthy();
    expect(screen.getByLabelText("Transaction currency").textContent).toContain("EUR");
  });

  it("preselects the last-used session currency", async () => {
    setLastUsedTransactionCurrency("USD");
    await renderForm();

    expect(screen.getByLabelText("Transaction currency").textContent).toContain("USD");
  });

  it("shows converted helper text for a cross-currency amount", async () => {
    setLastUsedTransactionCurrency("USD");
    await renderForm();

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "10.00" } });

    await waitFor(() => {
      expect(screen.getByText(/at 0.92 on 2026-07-09/)).toBeTruthy();
    });
  });

  it("hides Adjust rate for the default currency", async () => {
    await renderForm();

    expect(screen.queryByRole("button", { name: "Adjust rate" })).toBeNull();
  });

  it("lets the person enter a manual rate", async () => {
    setLastUsedTransactionCurrency("USD");
    await renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Adjust rate" }));
    expect(screen.getByLabelText("Manual exchange rate")).toBeTruthy();
  });

  it("falls back to the default when last-used currency is disabled", async () => {
    vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(
      Result.succeed([{ ...currencies[0] }, { ...currencies[1], status: "disabled" }]),
    );
    setLastUsedTransactionCurrency("USD");
    await renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Transaction currency").textContent).toContain("EUR");
    });
  });

  it("uses the locked revision for amount-only edits", async () => {
    const transaction = sampleTransaction({
      id: "locked-usd",
      amount: 1000,
      currency: "USD",
      convertedAmount: 850,
      convertedCurrency: "EUR",
      exchangeRate: {
        variant: "automatic",
        rateDate: "2026-07-01",
        sourceCurrency: "USD",
        referenceCurrency: "EUR",
        originalDecimal: "0.85",
        origin: "supplied",
      },
    });

    render(
      <CurrencyBootstrapProvider>
        <Drawer open swipeDirection="right">
          <TransactionFormDrawer
            mode={{ type: "edit", transaction }}
            categories={[]}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
          />
        </Drawer>
      </CurrencyBootstrapProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText("Amount")).toBeTruthy());

    await waitFor(() => {
      expect(screen.getByText(/at 0.85 on 2026-07-01/)).toBeTruthy();
    });
    expect(currencyCommands.getTransactionExchangeRateQuote).not.toHaveBeenCalled();
  });
});
