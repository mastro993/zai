import { describe, expect, it, vi } from "vitest";

import { applyStatusBarTheme, nextStatusBarTheme } from "../theme-toggle";

describe("nextStatusBarTheme", () => {
  it("pins dark when following a light system", () => {
    expect(nextStatusBarTheme("light", "light")).toBe("dark");
  });

  it("pins light when following a dark system", () => {
    expect(nextStatusBarTheme("dark", "dark")).toBe("light");
  });

  it("clears a dark pin back to a light system", () => {
    expect(nextStatusBarTheme("dark", "light")).toBeUndefined();
  });

  it("clears a light pin back to a dark system", () => {
    expect(nextStatusBarTheme("light", "dark")).toBeUndefined();
  });
});

describe("applyStatusBarTheme", () => {
  it("stores an override that differs from the system", () => {
    const setTheme = vi.fn();
    const storage = { removeItem: vi.fn() };

    applyStatusBarTheme("dark", setTheme, storage);

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("removes the stored value instead of persisting system", () => {
    let stored: string | undefined = "dark";
    const setTheme = (theme: string) => {
      stored = theme;
    };

    applyStatusBarTheme(undefined, setTheme, {
      removeItem: () => {
        stored = undefined;
      },
    });

    expect(stored).toBeUndefined();
  });
});
