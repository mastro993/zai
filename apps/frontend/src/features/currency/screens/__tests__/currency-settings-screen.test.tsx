// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

import * as currencyCommands from "../../commands/currency";
import * as currencyEvents from "../../commands/currency-state-events";
import { CurrencyBootstrapProvider } from "../../hooks/use-currency-bootstrap";
import { CurrencySettingsScreen } from "../currency-settings-screen";

const catalog = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
];

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
];

let emitEvent: (payload: string) => void = () => undefined;

const renderSettings = () =>
  render(
    <CurrencyBootstrapProvider>
      <CurrencySettingsScreen />
    </CurrencyBootstrapProvider>,
  );

describe("CurrencySettingsScreen", () => {
  beforeEach(() => {
    emitEvent = () => undefined;
    vi.spyOn(currencyEvents, "createCurrencyStateEventTransport").mockImplementation(() => ({
      subscribe: (onEvent, _onReconnect) => {
        emitEvent = onEvent;
        return {
          ready: Promise.resolve(Result.succeed(undefined)),
          close: () => undefined,
        };
      },
    }));
    vi.spyOn(currencyCommands, "getCurrencyBootstrap").mockResolvedValue(
      Result.succeed({ setupComplete: true, defaultCurrency: "EUR" }),
    );
    vi.spyOn(currencyCommands, "getSupportedCurrencies").mockResolvedValue(Result.succeed(catalog));
    vi.spyOn(currencyCommands, "getCurrencyStatus").mockResolvedValue(
      Result.succeed({ job: null }),
    );
    vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(Result.succeed(currencies));
    vi.spyOn(currencyCommands, "startCurrencyAddition").mockResolvedValue(
      Result.fail(new CommandError("Confirm the provider", { code: "providerDisclosureRequired" })),
    );
    vi.spyOn(currencyCommands, "disableCurrency").mockResolvedValue(Result.succeed(currencies[0]));
    vi.spyOn(currencyCommands, "startDefaultCurrencyChange").mockResolvedValue(
      Result.succeed({
        jobId: "job-default",
        type: "changeDefault",
        status: "running",
        stageCurrent: 0,
        stageTotal: 2,
        currencyCode: "USD",
      }),
    );
    vi.spyOn(currencyCommands, "retryExchangeRateRefresh").mockResolvedValue(
      Result.succeed(undefined),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the ledger table and asks for ECB disclosure on first add", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByText("Euro")).toBeTruthy();
    });
    expect(screen.getByLabelText("Set EUR as default currency")).toBeTruthy();
    expect(screen.getByLabelText("EUR refresh")).toBeTruthy();
    expect(screen.getByText("Idle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();

    fireEvent.click(screen.getByRole("combobox", { name: "Add currency" }));
    fireEvent.click(await screen.findByText("USD US Dollar"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(currencyCommands.startCurrencyAddition).toHaveBeenCalledWith("USD", false);
    });
    expect(screen.getByText("Use European Central Bank rates?")).toBeTruthy();
  });

  it("retries refresh without clearing the table", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retry now" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry now" }));
    await waitFor(() => {
      expect(currencyCommands.retryExchangeRateRefresh).toHaveBeenCalledOnce();
    });
  });

  it("shows live refresh progress on each currency row", async () => {
    renderSettings();
    await waitFor(() => {
      expect(screen.getByLabelText("EUR refresh")).toBeTruthy();
    });
    await act(async () => {
      emitEvent(
        JSON.stringify({
          version: 1,
          type: "refreshProgress",
          current: 18,
          total: 28,
        }),
      );
    });
    expect(screen.getByText("Refreshing")).toBeTruthy();
    expect(screen.getByText("18 of 28")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
});
