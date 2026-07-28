// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryBadge } from "../category-badge";
import { CategoryColorPicker } from "../category-color-picker";

describe("CategoryColorPicker", () => {
  afterEach(() => cleanup());

  it("renders each color as a badge preview", () => {
    render(
      <>
        <CategoryBadge color="#C55B26">Reference badge</CategoryBadge>
        <CategoryColorPicker value="#C55B26" onChange={vi.fn()} />
      </>,
    );

    const referenceBadge = screen.getByText("Reference badge").parentElement;
    const orangeChoice = screen.getByRole("button", { name: "Select Orange" });

    expect(referenceBadge).not.toBeNull();
    expect(orangeChoice.textContent).toBe("Aa");
    expect(orangeChoice.style.backgroundColor).toBe(referenceBadge?.style.backgroundColor);
    expect(orangeChoice.style.color).toBe(referenceBadge?.style.color);
  });

  it("uses only a rounded border to highlight the selected color", () => {
    render(<CategoryColorPicker value="#C55B26" onChange={vi.fn()} />);

    const selectedChoice = screen.getByRole("button", { name: "Select Orange" });

    expect(selectedChoice.getAttribute("aria-pressed")).toBe("true");
    expect(selectedChoice.classList.contains("rounded-(--radius)")).toBe(true);
    expect(selectedChoice.classList.contains("border-foreground")).toBe(true);
    expect(selectedChoice.classList.contains("ring-2")).toBe(false);
    expect(selectedChoice.querySelector("svg")).toBeNull();
  });
});
