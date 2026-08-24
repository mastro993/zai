import { TickDouble01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";

import { useAlertsController } from "../hooks/use-alerts-controller";
import { AlertRow } from "./alert-row";
import { AlertsLedgerFilters } from "./alerts-ledger-filters";
import { AlertsLedgerSkeleton } from "./alerts-ledger-skeleton";

export function AlertsLedgerDrawer() {
  const {
    bellRef,
    clearFilters,
    closeLedger,
    destinationFeedback,
    errorMessage,
    filters,
    hasActiveFilters,
    isLedgerOpen,
    ledgerFocusAlertId,
    items,
    lifecycleErrors,
    lifecyclePendingId,
    loadOlder,
    loadOlderError,
    loadOlderStatus,
    markAllRead,
    markAllReadError,
    markAllReadPending,
    nextCursor,
    openAlert,
    refresh,
    refreshStatus,
    setReadStateFilter,
    setSeverityFilter,
    toggleAlertReadState,
    unreadCount,
    unreadCountKnown,
  } = useAlertsController();

  const isLoading = (refreshStatus === "idle" || refreshStatus === "loading") && items.length === 0;
  const showError = refreshStatus === "error" && errorMessage !== null;
  const showUnfilteredEmpty =
    refreshStatus === "ready" && items.length === 0 && !showError && !hasActiveFilters;
  const showFilteredEmpty =
    refreshStatus === "ready" && items.length === 0 && !showError && hasActiveFilters;
  const showUnreadCount = unreadCountKnown && unreadCount > 0;

  return (
    <Drawer
      open={isLedgerOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeLedger();
        }
      }}
      swipeDirection="right"
    >
      <DrawerContent
        aria-label="Notifications"
        className="[--drawer-bleed-background:transparent] [--drawer-inset:1rem] data-[swipe-axis=x]:w-[calc(100%-2rem)] sm:data-[swipe-axis=x]:w-96"
        finalFocus={bellRef}
      >
        <DrawerHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <DrawerTitle>Notifications</DrawerTitle>
              {showUnreadCount ? (
                <Badge
                  variant="secondary"
                  aria-hidden
                  className="min-w-5 px-1.5 font-mono text-[11px] font-bold text-primary tabular-nums"
                >
                  {unreadCount}
                </Badge>
              ) : null}
            </div>
            {showUnreadCount ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={markAllReadPending ? "Marking all read" : "Mark all read"}
                disabled={markAllReadPending}
                onClick={() => void markAllRead()}
              >
                {markAllReadPending ? (
                  <Spinner />
                ) : (
                  <HugeiconsIcon icon={TickDouble01Icon} strokeWidth={2} />
                )}
              </Button>
            ) : null}
          </div>
          <DrawerDescription className="sr-only">
            {unreadCount === 1 ? "1 unread notification" : `${unreadCount} unread notifications`}
          </DrawerDescription>
          {markAllReadError ? (
            <p className="pt-2 text-xs text-destructive" role="alert">
              {markAllReadError}
            </p>
          ) : null}
        </DrawerHeader>

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
                  autoFocus={ledgerFocusAlertId === alert.id}
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
      </DrawerContent>
    </Drawer>
  );
}
