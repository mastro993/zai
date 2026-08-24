// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useSettingsReturnHref } from "../use-settings-return-href";

function Probe({ pathname }: { pathname: string }) {
  const href = useSettingsReturnHref(pathname);

  return <p>{href}</p>;
}

describe("useSettingsReturnHref", () => {
  afterEach(() => {
    cleanup();
  });

  it("tracks the last non-settings path", () => {
    const { rerender } = render(<Probe pathname="/cash-flow/transactions" />);

    expect(screen.getByText("/cash-flow/transactions")).toBeTruthy();

    rerender(<Probe pathname="/settings/appearance" />);

    expect(screen.getByText("/cash-flow/transactions")).toBeTruthy();
  });

  it("defaults to dashboard when settings is the first path", () => {
    render(<Probe pathname="/settings/currencies" />);

    expect(screen.getByText("/dashboard")).toBeTruthy();
  });
});
