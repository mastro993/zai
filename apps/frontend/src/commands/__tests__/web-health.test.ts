import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { probeBackendHealth } from "../web-health";

const fetchMock = vi.hoisted(() => vi.fn());

describe("probeBackendHealth", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when /health reports ok", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await probeBackendHealth()).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3000/health");
  });

  it("returns false when the backend is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await probeBackendHealth()).toBe(false);
  });

  it("returns false when health is not ok", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));

    expect(await probeBackendHealth()).toBe(false);
  });
});
