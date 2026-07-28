import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError } from "../errors";
import { invokeDecodedCommand } from "../shared";
import { buildWebRequestUrl } from "../web-transport";
import { joinWebApiUrl, resolveWebApiBaseUrl, resolveWebApiOrigin } from "../web-api";
import { createWebCommandTransport } from "../web-transport";
import { CATEGORY_COMMANDS } from "@/features/categories/commands/registry";
import { BUDGET_COMMANDS } from "@/features/budgets/commands/registry";
import { TRANSACTION_COMMANDS } from "@/features/transactions/commands/registry";

const fetchMock = vi.hoisted(() => vi.fn());

describe("web request URL helpers", () => {
  it("builds an absolute URL from a request path and query", () => {
    expect(
      buildWebRequestUrl("http://127.0.0.1:3000/api", {
        method: "GET",
        path: "/categories",
        query: { parentId: "parent-1" },
      }),
    ).toBe("http://127.0.0.1:3000/api/categories?parentId=parent-1");
  });

  it("resolves the API base from the configured origin", () => {
    expect(resolveWebApiBaseUrl()).toBe("http://127.0.0.1:3000/api");
  });
});

describe("web API config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the default API origin", () => {
    vi.stubEnv("VITE_ZAI_API_ORIGIN", "");
    expect(resolveWebApiOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("strips trailing slashes from the configured API origin", () => {
    vi.stubEnv("VITE_ZAI_API_ORIGIN", "http://127.0.0.1:3000/");
    expect(resolveWebApiOrigin()).toBe("http://127.0.0.1:3000");
  });

  it("joins origin and API prefixes without duplicate slashes", () => {
    expect(joinWebApiUrl("http://127.0.0.1:3000", "api")).toBe("http://127.0.0.1:3000/api");
  });
});

describe("web command transport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_ZAI_BUILD_TARGET", "web");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns successful JSON responses and the app header", async () => {
    const payload = [{ id: "category-1", name: "Food" }];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();
    const result = await transport.invoke(CATEGORY_COMMANDS.get_transaction_categories, {
      parentId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/categories", {
      method: "GET",
      headers: { "x-zai-app": "zai" },
      body: undefined,
    });
    expect(result).toEqual(payload);
  });

  it("adds JSON content type only when a request has a body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "category-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();
    await transport.invoke(CATEGORY_COMMANDS.create_transaction_category, {
      newCategory: { name: "Food", parentId: null, description: null, hue: 20 },
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/categories", {
      method: "POST",
      headers: { "x-zai-app": "zai", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Food",
        parentId: null,
        description: null,
        hue: 20,
      }),
    });
  });

  it("sends the app header on bodyless DELETE requests", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "txn-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();
    await transport.invoke(TRANSACTION_COMMANDS.delete_transaction, { transactionId: "txn-1" });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/transactions/txn-1", {
      method: "DELETE",
      headers: { "x-zai-app": "zai" },
      body: undefined,
    });
  });

  it("returns undefined for 204 No Content responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const transport = createWebCommandTransport();
    await expect(
      transport.invoke(BUDGET_COMMANDS.delete_budget, {
        budgetId: "budget-1",
        expectedRevision: 2,
      }),
    ).resolves.toBe(undefined);
  });

  it("rejects malformed builder inputs before fetch", async () => {
    const transport = createWebCommandTransport();

    await expect(
      transport.invoke(CATEGORY_COMMANDS.create_transaction_category, {
        newCategory: "malformed" as never,
      }),
    ).rejects.toMatchObject({ name: "CommandError" });
    await expect(
      transport.invoke(BUDGET_COMMANDS.delete_budget, {
        budgetId: "budget-1",
        expectedRevision: "invalid" as never,
      }),
    ).rejects.toMatchObject({ name: "CommandError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves structured fields from non-2xx JSON error bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "notFound",
          message: "Failed to load transaction: Not found",
          details: { resource: "transaction", id: "txn-404" },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const transport = createWebCommandTransport();
    await expect(
      transport.invoke(TRANSACTION_COMMANDS.get_transaction, { transactionId: "txn-404" }),
    ).rejects.toMatchObject({
      name: "CommandError",
      code: "notFound",
      message: "Failed to load transaction: Not found",
      details: { resource: "transaction", id: "txn-404" },
    });
  });

  it("falls back to a status-derived message when error JSON is malformed", async () => {
    fetchMock.mockResolvedValue(new Response("not-json", { status: 404 }));

    const transport = createWebCommandTransport();
    await expect(
      transport.invoke(CATEGORY_COMMANDS.get_transaction_categories, { parentId: null }),
    ).rejects.toEqual(new CommandError("Request failed with status 404"));
  });

  it("preserves CommandResult semantics through decoded invocation", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "validation",
          message: "Failed to create transaction category Food: bad",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await invokeDecodedCommand(CATEGORY_COMMANDS.create_transaction_category, {
      newCategory: { name: "Food", parentId: null, description: null, hue: 20 },
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toBeInstanceOf(CommandError);
    expect(result.error).toMatchObject({ code: "validation" });
    expect(result.error.message).toBe("Failed to create transaction category Food: bad");
  });
});
