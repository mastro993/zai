// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer } from "@/components/ui/drawer";

import { CategoryFormDrawer } from "../category-form-drawer";

describe("CategoryFormDrawer", () => {
  afterEach(() => cleanup());

  it("submits the selected root color", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Drawer open swipeDirection="right">
        <CategoryFormDrawer
          open
          mode={{ type: "create-root" }}
          categories={[]}
          onSubmit={onSubmit}
        />
      </Drawer>,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Food" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Orange" }));
    fireEvent.click(screen.getByRole("button", { name: "Save category" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ color: "#C55B26" })),
    );
  });
});
