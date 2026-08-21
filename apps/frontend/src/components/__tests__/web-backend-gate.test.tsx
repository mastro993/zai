// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebBackendGate } from "../web-backend-gate";

const fetchMock = vi.hoisted(() => vi.fn());

const okHealth = () =>
  new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("WebBackendGate", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders children immediately when the gate is disabled", () => {
    render(
      <WebBackendGate enabled={false}>
        <p>App ready</p>
      </WebBackendGate>,
    );

    expect(screen.getByText("App ready")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the splash when health is already ok", async () => {
    fetchMock.mockResolvedValue(okHealth());

    render(
      <WebBackendGate enabled>
        <p>App ready</p>
      </WebBackendGate>,
    );

    expect(screen.queryByLabelText("Zai")).toBeNull();
    await waitFor(() => expect(screen.getByText("App ready")).toBeTruthy());
    expect(screen.queryByLabelText("Zai")).toBeNull();
  });

  it("fades the splash in only after health fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okHealth());

    render(
      <WebBackendGate enabled>
        <p>App ready</p>
      </WebBackendGate>,
    );

    expect(screen.queryByLabelText("Zai")).toBeNull();
    expect(screen.queryByText("App ready")).toBeNull();

    await waitFor(() => expect(screen.getByLabelText("Zai")).toBeTruthy());
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();

    await waitFor(() => expect(screen.getByText("App ready")).toBeTruthy(), { timeout: 2000 });
  });
});
