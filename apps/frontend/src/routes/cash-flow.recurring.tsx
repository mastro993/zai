import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import {
  RecurringSelectionProvider,
  useRecurringSelectionContext,
} from "@/features/recurring-transactions/hooks/recurring-selection-context";

export const Route = createFileRoute("/cash-flow/recurring")({
  component: RecurringLayout,
});

function RecurringLayout() {
  return (
    <RecurringSelectionProvider>
      <ClearSelectionOnExit>
        <Outlet />
      </ClearSelectionOnExit>
    </RecurringSelectionProvider>
  );
}

function ClearSelectionOnExit({ children }: { children: ReactNode }) {
  const { clearSelection } = useRecurringSelectionContext();

  useEffect(() => {
    return () => {
      clearSelection();
    };
  }, [clearSelection]);

  return children;
}
