import { Result } from "@praha/byethrow";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, type Dispatch, type SetStateAction } from "react";

import { getBudget } from "@/features/cash-flow/commands/budgets";

import { markAlertRead } from "../commands/alerts";
import { isNavigableAlertDestination, isUnreadAlert } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";

export interface DestinationFeedback {
  alertId: string;
  message: string;
}

type ApplyLifecycleResult = (
  previous: DomainAlert,
  result: Awaited<ReturnType<typeof markAlertRead>>,
) => DomainAlert | null;

interface UseAlertDestinationOptions {
  applyLifecycleResult: ApplyLifecycleResult;
  closeLedger: () => void;
  setDestinationFeedback: Dispatch<SetStateAction<DestinationFeedback | null>>;
  setLifecyclePendingId: Dispatch<SetStateAction<string | null>>;
}

const STALE_BUDGET_MESSAGE = "This budget is no longer available. The alert history is unchanged.";

export function useAlertDestination({
  applyLifecycleResult,
  closeLedger,
  setDestinationFeedback,
  setLifecyclePendingId,
}: UseAlertDestinationOptions) {
  const navigate = useNavigate();

  return useCallback(
    async (alert: DomainAlert) => {
      setDestinationFeedback(null);
      let current = alert;

      if (isUnreadAlert(alert)) {
        setLifecyclePendingId(alert.id);
        const result = await markAlertRead(alert.id);
        const updated = applyLifecycleResult(alert, result);
        setLifecyclePendingId(null);
        if (!updated) {
          return;
        }
        current = updated;
      }

      if (!isNavigableAlertDestination(current.destination)) {
        return;
      }

      const budgetResult = await getBudget(current.destination.budgetId);
      if (Result.isFailure(budgetResult)) {
        setDestinationFeedback({
          alertId: current.id,
          message: STALE_BUDGET_MESSAGE,
        });
        return;
      }

      closeLedger();
      await navigate({
        to: "/cash-flow/budgets/$budgetId",
        params: { budgetId: current.destination.budgetId },
      });
    },
    [applyLifecycleResult, closeLedger, navigate, setDestinationFeedback, setLifecyclePendingId],
  );
}
