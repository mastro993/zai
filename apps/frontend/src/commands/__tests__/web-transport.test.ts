import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "@praha/byethrow";

import { CommandError } from "../errors";
import { invokeCommand } from "../shared";
import { buildWebRequestSpec, buildWebRequestUrl, resolveWebApiBaseUrl } from "../web-command-map";
import { createWebCommandTransport } from "../web-transport";

const fetchMock = vi.hoisted(() => vi.fn());

describe("web command map", () => {
  it("maps get_transaction_categories without parentId to GET /categories", () => {
    expect(buildWebRequestSpec("get_transaction_categories", { parentId: null })).toEqual({
      method: "GET",
      path: "/categories",
      query: undefined,
    });
  });

  it("maps get_transaction_categories with parentId to a filtered GET /categories", () => {
    expect(buildWebRequestSpec("get_transaction_categories", { parentId: "parent-1" })).toEqual({
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });
  });

  it("maps create_transaction_category to POST /categories with newCategory body", () => {
    const newCategory = {
      name: "Food",
      parentId: null,
      description: null,
      color: "#ff0000",
    };

    expect(
      buildWebRequestSpec("create_transaction_category", {
        newCategory,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories",
      body: newCategory,
    });
  });

  it("maps update_transaction_category to PUT /categories/:id without body id", () => {
    expect(
      buildWebRequestSpec("update_transaction_category", {
        updatedCategory: {
          id: "category-1",
          name: "Dining",
          parentId: null,
          description: "Restaurants",
          color: "#123456",
        },
      }),
    ).toEqual({
      method: "PUT",
      path: "/categories/category-1",
      body: {
        name: "Dining",
        parentId: null,
        description: "Restaurants",
        color: "#123456",
      },
    });
  });

  it("maps delete_transaction_categories to POST /categories/bulk-delete", () => {
    expect(
      buildWebRequestSpec("delete_transaction_categories", {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/bulk-delete",
      body: {
        categoryIds: ["category-1", "category-2"],
        childrenStrategy: "promote",
      },
    });
  });

  it("maps import_transaction_categories to POST /categories/import", () => {
    const categories = [{ name: "Food", color: "#ff0000" }];

    expect(
      buildWebRequestSpec("import_transaction_categories", {
        categories,
      }),
    ).toEqual({
      method: "POST",
      path: "/categories/import",
      body: { categories },
    });
  });

  it("builds absolute URLs from the configured API base", () => {
    const url = buildWebRequestUrl("http://127.0.0.1:3000/api/cash-flow", {
      method: "GET",
      path: "/categories",
      query: { parentId: "parent-1" },
    });

    expect(url).toBe("http://127.0.0.1:3000/api/cash-flow/categories?parentId=parent-1");
  });

  it("falls back to the default API base URL", () => {
    expect(resolveWebApiBaseUrl()).toBe("http://127.0.0.1:3000/api/cash-flow");
  });

  it("rejects unknown commands", () => {
    expect(() => buildWebRequestSpec("missing_command")).toThrowError(
      new CommandError("Unknown web command: missing_command"),
    );
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

  it("returns succeeded command results for 2xx JSON responses", async () => {
    const payload = [{ id: "category-1", name: "Food" }];
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();
    const result = await transport.invoke<Array<{ id: string }>>("get_transaction_categories", {
      parentId: null,
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3000/api/cash-flow/categories", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
    expect(result).toEqual(payload);
  });

  it("maps non-2xx JSON error bodies into CommandError messages", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Failed to load transaction_categories: boom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const transport = createWebCommandTransport();

    await expect(
      transport.invoke("get_transaction_categories", { parentId: null }),
    ).rejects.toEqual(new CommandError("Failed to load transaction_categories: boom"));
  });

  it("falls back to a status-derived message when error JSON is malformed", async () => {
    fetchMock.mockResolvedValue(
      new Response("not-json", {
        status: 404,
      }),
    );

    const transport = createWebCommandTransport();

    await expect(
      transport.invoke("get_transaction_categories", { parentId: null }),
    ).rejects.toEqual(new CommandError("Request failed with status 404"));
  });

  it("preserves CommandResult semantics through invokeCommand", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Failed to create transaction category Food: bad" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await invokeCommand("create_transaction_category", {
      newCategory: { name: "Food", parentId: null, description: null, color: "#ff0000" },
    });

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isSuccess(result)) {
      return;
    }
    expect(result.error).toBeInstanceOf(CommandError);
    expect(result.error.message).toBe("Failed to create transaction category Food: bad");
  });
});
