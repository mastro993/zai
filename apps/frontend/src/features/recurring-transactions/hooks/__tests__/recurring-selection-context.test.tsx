// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  RecurringSelectionProvider,
  useRecurringSelectionContext,
} from "../recurring-selection-context";

function wrapper({ children }: { children: ReactNode }) {
  return <RecurringSelectionProvider>{children}</RecurringSelectionProvider>;
}

describe("recurring selection context", () => {
  it("freezes matching revisions and keeps frozen scope after partial success", () => {
    const { result } = renderHook(() => useRecurringSelectionContext(), { wrapper });

    act(() => {
      result.current.applySelectAllMatching(
        [
          { id: "rent", revision: 3 },
          { id: "food", revision: 7 },
        ],
        "v1-frozen",
      );
    });
    act(() => result.current.setSelectedIds(new Set(["food"])));

    expect(result.current.selectedIds).toEqual(new Set(["food"]));
    expect(result.current.revisionsById).toEqual(new Map([["food", 7]]));
    expect(result.current.selectAllMatching).toBe(true);
    expect(result.current.frozenFilterFingerprint).toBe("v1-frozen");
  });

  it("clears frozen scope when user changes selection explicitly", () => {
    const { result } = renderHook(() => useRecurringSelectionContext(), { wrapper });

    act(() => {
      result.current.applySelectAllMatching([{ id: "rent", revision: 3 }], "v1-frozen");
      result.current.toggleRow({ id: "rent", revision: 4 }, false);
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectAllMatching).toBe(false);
    expect(result.current.frozenFilterFingerprint).toBeUndefined();
  });

  it("keeps manually selected hidden sources when freezing matching scope", () => {
    const { result } = renderHook(() => useRecurringSelectionContext(), { wrapper });

    act(() => result.current.toggleRow({ id: "hidden", revision: 2 }, true));
    act(() => result.current.applySelectAllMatching([{ id: "visible", revision: 5 }], "v1"));

    expect([...result.current.selectedIds].toSorted()).toEqual(["hidden", "visible"]);
  });
});
