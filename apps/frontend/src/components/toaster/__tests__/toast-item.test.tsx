// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
  },
}));

import { ToastItem } from "../toast-item";

afterEach(() => {
  cleanup();
});

describe("ToastItem", () => {
  it("renders muted success shell with title and description", () => {
    render(
      <ToastItem
        id={1}
        variant="success"
        title="Transaction saved"
        description="Groceries · −€42.50"
      />,
    );

    expect(screen.getByRole("status").getAttribute("data-variant")).toBe("success");
    expect(screen.getByText("Transaction saved")).toBeTruthy();
    expect(screen.getByText("Groceries · −€42.50")).toBeTruthy();
  });

  it("renders inline action for warning toasts", () => {
    const onClick = vi.fn();
    render(
      <ToastItem
        id={2}
        variant="warning"
        title="Budget nearly spent"
        action={{ label: "Open alert", onClick }}
      />,
    );

    expect(screen.getByRole("button", { name: "Open alert" })).toBeTruthy();
  });
});
