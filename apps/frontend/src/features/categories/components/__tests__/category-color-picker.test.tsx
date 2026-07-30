// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryBadge } from "../category-badge";
import { CategoryColorPicker } from "../category-color-picker";

describe("CategoryColorPicker", () => {
  afterEach(() => cleanup());

  it("renders each color as a badge preview", () => {
    render(
      <>
        <CategoryBadge color="#C32828">Reference badge</CategoryBadge>
        <CategoryColorPicker value="#C32828" onChange={vi.fn()} />
      </>,
    );

    const referenceBadge = screen.getByText("Reference badge").parentElement;
    const redChoice = screen.getByRole("button", { name: "Select Red" });

    expect(referenceBadge).not.toBeNull();
    expect(redChoice.textContent).toBe("Aa");
    expect(redChoice.style.backgroundColor).toBe(referenceBadge?.style.backgroundColor);
    expect(redChoice.style.color).toBe(referenceBadge?.style.color);
    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "Choose custom color" })).toBeTruthy();
  });

  it("uses only a rounded border to highlight the selected color", () => {
    render(<CategoryColorPicker value="#C32828" onChange={vi.fn()} />);

    const selectedChoice = screen.getByRole("button", { name: "Select Red" });

    expect(selectedChoice.getAttribute("aria-pressed")).toBe("true");
    expect(selectedChoice.classList.contains("rounded-(--radius)")).toBe(true);
    expect(selectedChoice.classList.contains("border-foreground")).toBe(true);
    expect(selectedChoice.classList.contains("ring-2")).toBe(false);
    expect(selectedChoice.querySelector("svg")).toBeNull();
  });

  it("previews and selects a stored custom color", () => {
    render(
      <>
        <CategoryBadge color="#123456">Reference custom badge</CategoryBadge>
        <CategoryColorPicker value="#123456" onChange={vi.fn()} />
      </>,
    );

    const referenceBadge = screen.getByText("Reference custom badge").parentElement;
    const customChoice = screen.getByRole("button", { name: "Edit custom color" });

    expect(customChoice.getAttribute("aria-pressed")).toBe("true");
    expect(customChoice.textContent).toBe("Aa");
    expect(customChoice.style.backgroundColor).toBe(referenceBadge?.style.backgroundColor);
    expect(customChoice.style.color).toBe(referenceBadge?.style.color);
  });

  it("renders the custom color choice as a borderless opaque surface", () => {
    render(<CategoryColorPicker value="#C32828" onChange={vi.fn()} />);

    const customChoice = screen.getByRole("button", {
      name: "Choose custom color",
    });

    expect(customChoice.classList.contains("border-0")).toBe(true);
    expect(customChoice.style.backgroundColor).toBe("var(--background)");
  });

  it("softens the custom color gradient without fading the tile", () => {
    render(<CategoryColorPicker value="#C32828" onChange={vi.fn()} />);

    const customChoice = screen.getByRole("button", {
      name: "Choose custom color",
    });
    const gradientLayer = customChoice.querySelector<HTMLElement>("[aria-hidden='true']");
    const icon = customChoice.querySelector("svg");

    expect(gradientLayer).not.toBeNull();
    expect(gradientLayer?.classList.contains("opacity-60")).toBe(true);
    expect(gradientLayer?.style.backgroundImage).toContain("conic-gradient");
    expect(icon?.classList.contains("text-white/80")).toBe(true);
  });

  it("opens the custom picker at the current selected color", async () => {
    render(<CategoryColorPicker value="#C32828" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose custom color" }));

    const hexInput = await screen.findByRole("textbox", { name: "Custom color HEX" });
    expect(hexInput.getAttribute("value")).toBe("#C32828");
    expect(screen.getByRole("group", { name: "Custom color picker" })).toBeTruthy();
  });

  it("emits an uppercase six-digit custom color without closing the picker", async () => {
    const onChange = vi.fn();
    render(<CategoryColorPicker value="#C32828" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose custom color" }));
    const hexInput = await screen.findByRole("textbox", { name: "Custom color HEX" });
    fireEvent.change(hexInput, { target: { value: "#1a2b3c" } });

    expect(onChange).toHaveBeenCalledWith("#1A2B3C");
    expect(screen.getByRole("group", { name: "Custom color picker" })).toBeTruthy();
  });

  it("expands three-digit HEX shorthand on blur", async () => {
    const onChange = vi.fn();
    render(<CategoryColorPicker value="#C32828" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose custom color" }));
    const hexInput = await screen.findByRole("textbox", { name: "Custom color HEX" });
    fireEvent.change(hexInput, { target: { value: "#a2f" } });
    fireEvent.blur(hexInput);

    expect(onChange).toHaveBeenCalledWith("#AA22FF");
  });

  it("emits visual picker changes as uppercase HEX", async () => {
    const onChange = vi.fn();
    render(<CategoryColorPicker value="#C32828" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose custom color" }));
    const hueSlider = await screen.findByRole("slider", { name: "Hue" });
    fireEvent.keyDown(hueSlider, { key: "ArrowRight", keyCode: 39, which: 39 });

    expect(onChange).toHaveBeenCalledWith("#C25729");
  });
});
