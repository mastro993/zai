// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { PreWorkspaceWindowChrome, WindowControls } from "../window-controls";
import * as windowChrome from "@/lib/window-chrome";

const startDragging = vi.fn();
const toggleMaximize = vi.fn();
const minimize = vi.fn();
const close = vi.fn();

const mockAdapter = (usesCustomWindowControls: boolean) => {
  vi.spyOn(windowChrome, "createWindowChromeAdapter").mockReturnValue({
    supportsNativeWindowChrome: usesCustomWindowControls,
    usesCustomWindowControls,
    startDragging,
    toggleMaximize,
    minimize,
    close,
  });
};

describe("WindowControls", () => {
  beforeEach(() => {
    startDragging.mockReset();
    toggleMaximize.mockReset();
    minimize.mockReset();
    close.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("hides custom controls on web and native macOS chrome", () => {
    mockAdapter(false);
    const { rerender } = render(<WindowControls buildTarget="web" />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    rerender(<WindowControls buildTarget="tauri" />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("closes, minimizes, and maximizes from Linux client-side controls", () => {
    mockAdapter(true);
    render(<WindowControls buildTarget="tauri" />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
  });
});

describe("PreWorkspaceWindowChrome", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const renderChrome = (usesCustomWindowControls: boolean, children: ReactNode = "Setup") => {
    mockAdapter(usesCustomWindowControls);
    return render(
      <PreWorkspaceWindowChrome buildTarget="tauri">{children}</PreWorkspaceWindowChrome>,
    );
  };

  it("leaves macOS setup screens without an extra chrome strip", () => {
    renderChrome(false);
    expect(screen.queryByText("Setup")).not.toBeNull();
    expect(document.querySelector('[data-slot="pre-workspace-window-chrome"]')).toBeNull();
  });

  it("adds a Linux drag strip above setup content", () => {
    mockAdapter(true);
    render(
      <PreWorkspaceWindowChrome buildTarget="tauri">Choose currency</PreWorkspaceWindowChrome>,
    );

    expect(screen.queryByText("Choose currency")).not.toBeNull();
    expect(document.querySelector('[data-slot="pre-workspace-window-chrome"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="window-drag-region"]')).not.toBeNull();
  });
});
