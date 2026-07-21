// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Result } from "@praha/byethrow";
import { useRef, useState } from "react";

import { Drawer } from "@/components/ui/drawer";

import { RecurringCreateDrawer } from "../recurring-create-drawer";
import type { RecurringFormValues } from "../../types/recurring-transaction";

afterEach(() => {
  cleanup();
});

function Harness({
  onSubmit,
}: {
  onSubmit: (values: RecurringFormValues) => Promise<Result.Result<unknown, { message: string }>>;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);

  return (
    <>
      <button ref={buttonRef} type="button" onClick={() => setOpen(true)}>
        New recurring
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <RecurringCreateDrawer
          open={open}
          onOpenChange={setOpen}
          onSubmit={onSubmit}
          categories={[]}
          returnFocusRef={buttonRef}
        />
      </Drawer>
    </>
  );
}

describe("RecurringCreateDrawer", () => {
  it("submits a valid create and returns focus to the trigger", async () => {
    const onSubmit = vi.fn(async (values: RecurringFormValues) => {
      expect(values.name).toBe("Gym");
      expect(values.amount).toBe(4500);
      return Result.succeed({
        outcome: "succeeded",
        document: { recurringTransaction: { id: "rt-1", name: values.name } },
      });
    });

    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Gym" } });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "45.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create recurring transaction" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "New recurring" }));
    });
  });
});
