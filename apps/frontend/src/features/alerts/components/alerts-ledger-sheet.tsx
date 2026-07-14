import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useAlertsController } from "../hooks/use-alerts-controller";
import { AlertRow } from "./alert-row";
import { AlertsLedgerFilters } from "./alerts-ledger-filters";
import { AlertsLedgerSkeleton } from "./alerts-ledger-skeleton";

export function AlertsLedgerSheet() {
  const {
    clearFilters,
    closeLedger,
    destinationFeedback,
    errorMessage,
    filters,
    hasActiveFilters,
    isLedgerOpen,
    items,
    lifecycleErrors,
    lifecyclePendingId,
    loadOlder,
    loadOlderError,
    loadOlderStatus,
    nextCursor,
    openAlert,
    refresh,
    refreshStatus,
    setReadStateFilter,
    setSeverityFilter,
    toggleAlertReadState,
    unreadCount,
  } = useAlertsController();

  const isLoading = (refreshStatus === "idle" || refreshStatus === "loading") && items.length === 0;
  const showError = refreshStatus === "error" && errorMessage !== null;
  const showUnfilteredEmpty =
    refreshStatus === "ready" && items.length === 0 && !showError && !hasActiveFilters;
  const showFilteredEmpty =
    refreshStatus === "ready" && items.length === 0 && !showError && hasActiveFilters;

  return (
    <Sheet open={isLedgerOpen} onOpenChange={(open) => (open ? undefined : closeLedger())}>
      <SheetContent
        side="right"
        className="!w-screen !max-w-none gap-0 p-0 sm:!w-[28rem] sm:!max-w-[28rem]"
        aria-label="Alerts"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Alerts</SheetTitle>
          <SheetDescription>
            {unreadCount === 1 ? "1 unread alert" : `${unreadCount} unread alerts`}
          </SheetDescription>
        </SheetHeader>

        <AlertsLedgerFilters
          filters={filters}
          onReadStateChange={setReadStateFilter}
          onSeverityChange={setSeverityFilter}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isLoading ? <AlertsLedgerSkeleton /> : null}

          {showError ? (
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Saved alerts are unchanged. {errorMessage}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : null}

          {showUnfilteredEmpty ? (
            <p className="px-4 py-6 text-xs text-muted-foreground">
              Important tracked-finance changes appear here.
            </p>
          ) : null}

          {showFilteredEmpty ? (
            <div className="flex flex-col gap-3 px-4 py-6">
              <p className="text-xs text-muted-foreground">No alerts match these filters.</p>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}

          {!isLoading && items.length > 0
            ? items.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  destinationFeedback={
                    destinationFeedback?.alertId === alert.id ? destinationFeedback.message : null
                  }
                  isLifecyclePending={lifecyclePendingId === alert.id}
                  lifecycleError={lifecycleErrors[alert.id] ?? null}
                  onOpen={() => void openAlert(alert)}
                  onToggleReadState={() => void toggleAlertReadState(alert)}
                />
              ))
            : null}

          {nextCursor && items.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border px-4 py-4">
              {loadOlderError ? (
                <p className="text-xs text-muted-foreground">
                  Saved alerts are unchanged. {loadOlderError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadOlderStatus === "loading"}
                onClick={() => void loadOlder()}
              >
                {loadOlderStatus === "loading" ? "Loading…" : "Load older alerts"}
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
