// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapApp } from "../app-bootstrap";

describe("app bootstrap", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("does not start the router when a Tauri build is opened outside Tauri", () => {
    const isTauri = vi.fn(() => false);
    const getRouter = vi.fn(() => ({ id: "router" }));
    const render = vi.fn();

    bootstrapApp(document.getElementById("root"), "tauri", () => null, {
      isTauri,
      getRouter,
      render,
    });

    expect(render).not.toHaveBeenCalled();
    expect(getRouter).not.toHaveBeenCalled();
    expect(document.getElementById("root")?.textContent).toContain(
      "This desktop frontend must be opened by Tauri",
    );
  });
});
