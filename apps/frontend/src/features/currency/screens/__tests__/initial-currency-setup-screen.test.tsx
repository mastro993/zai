// @vitest-environment jsdom
import { Result } from "@praha/byethrow";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "@/commands/errors";

import * as currencyCommands from "../../commands/currency";
import * as currencyEvents from "../../commands/currency-state-events";
import { CurrencyBootstrapProvider } from "../../hooks/use-currency-bootstrap";
import { InitialCurrencySetupScreen } from "../initial-currency-setup-screen";

const catalog = [
  { code: "EUR", name: "Euro" },
  { code: "USD", name: "US Dollar" },
];

const renderSetup = () =>
  render(
    <CurrencyBootstrapProvider>
      <InitialCurrencySetupScreen />
    </CurrencyBootstrapProvider>,
  );

describe("InitialCurrencySetupScreen", () => {
  beforeEach(() => {
    vi.spyOn(currencyEvents, "createCurrencyStateEventTransport").mockImplementation(() => ({
      subscribe: (_onEvent, _onReconnect) => ({
        ready: Promise.resolve(Result.succeed(undefined)),
        close: () => undefined,
      }),
    }));
    vi.spyOn(currencyCommands, "getCurrencyBootstrap").mockResolvedValue(
      Result.succeed({ setupComplete: false, defaultCurrency: null }),
    );
    vi.spyOn(currencyCommands, "getSupportedCurrencies").mockResolvedValue(Result.succeed(catalog));
    vi.spyOn(currencyCommands, "getCurrencyStatus").mockResolvedValue(
      Result.succeed({ job: null }),
    );
    vi.spyOn(currencyCommands, "getCurrencies").mockResolvedValue(Result.succeed([]));
    vi.spyOn(currencyCommands, "completeInitialCurrencySetup").mockResolvedValue(
      Result.succeed({
        jobId: "job-1",
        type: "setup",
        status: "succeeded",
        stageCurrent: 1,
        stageTotal: 1,
        currencyCode: "USD",
      }),
    );
    vi.stubGlobal("navigator", { language: "en-US" });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("labels the locale-derived currency as a device suggestion and confirms it", async () => {
    renderSetup();

    await waitFor(() => {
      expect(screen.getByText("Suggested from this device")).toBeTruthy();
    });
    expect(screen.getByText("US Dollar (USD)")).toBeTruthy();
    expect(
      screen.getByText("USD is preselected from this device locale. You must confirm it."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(currencyCommands.completeInitialCurrencySetup).toHaveBeenCalledWith("USD");
    });
  });

  it("lets the user change the suggestion before confirming", async () => {
    renderSetup();
    await waitFor(() => {
      expect(screen.getByText("Euro (EUR)")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Euro (EUR)"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(currencyCommands.completeInitialCurrencySetup).toHaveBeenCalledWith("EUR");
    });
  });

  it("surfaces a command failure instead of pretending setup completed", async () => {
    vi.spyOn(currencyCommands, "completeInitialCurrencySetup").mockResolvedValue(
      Result.fail(new CommandError("setup exploded", { code: "internal" })),
    );
    renderSetup();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("setup exploded");
    });
  });
});
