// @vitest-environment jsdom

import { ShoppingBag01Icon } from "@hugeicons/core-free-icons";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DrawerSelect } from "../drawer-select";

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}));

const OPTIONS = [
  {
    value: "spending" as const,
    label: "Spending",
    description: "Count outflows.",
    icon: ShoppingBag01Icon,
  },
  {
    value: "net" as const,
    label: "Net",
    icon: ShoppingBag01Icon,
  },
];

describe("DrawerSelect", () => {
  afterEach(() => cleanup());

  it("shows placeholder when value is null", () => {
    render(
      <DrawerSelect
        id="demo"
        ariaLabel="Demo select"
        drawerTitle="Demo"
        placeholder="Pick one"
        value={null}
        options={OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Demo select" }).textContent).toContain("Pick one");
  });

  it("commits selection and closes drawer", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();

    render(
      <DrawerSelect
        id="demo"
        ariaLabel="Demo select"
        drawerTitle="Demo"
        placeholder="Pick one"
        value={null}
        options={OPTIONS}
        onChange={onChange}
        onBlur={onBlur}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Demo select" }));
    fireEvent.click(screen.getByRole("option", { name: /Net/ }));

    expect(onChange).toHaveBeenCalledWith("net");
    expect(onBlur).toHaveBeenCalled();
    expect(screen.queryByRole("option", { name: /Net/ })).toBeNull();
  });

  it("closes when parentOpen becomes false", () => {
    const { rerender } = render(
      <DrawerSelect
        id="demo"
        ariaLabel="Demo select"
        drawerTitle="Demo"
        placeholder="Pick one"
        value="spending"
        options={OPTIONS}
        parentOpen
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Demo select" }));
    expect(screen.getByRole("heading", { name: "Demo" })).toBeTruthy();

    rerender(
      <DrawerSelect
        id="demo"
        ariaLabel="Demo select"
        drawerTitle="Demo"
        placeholder="Pick one"
        value="spending"
        options={OPTIONS}
        parentOpen={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Demo" })).toBeNull();
  });
});
