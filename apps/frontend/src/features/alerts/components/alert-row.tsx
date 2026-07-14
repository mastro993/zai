import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, AlertCircleIcon, InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { domainAlertSeverityLabel, formatAlertCreatedAt } from "../lib/format";
import { isNavigableAlertDestination, isUnreadAlert } from "../lib/parse";
import type { DomainAlert, DomainAlertSeverity } from "../types/domain-alert";

const severityIcon = (severity: DomainAlertSeverity) => {
  switch (severity) {
    case "info":
      return InformationCircleIcon;
    case "warning":
      return Alert02Icon;
    case "critical":
      return AlertCircleIcon;
  }
};

interface AlertRowProps {
  alert: DomainAlert;
  destinationFeedback?: string | null;
  isLifecyclePending?: boolean;
  lifecycleError?: string | null;
  onOpen?: () => void;
  onToggleReadState?: () => void;
}

export function AlertRow({
  alert,
  destinationFeedback = null,
  isLifecyclePending = false,
  lifecycleError = null,
  onOpen,
  onToggleReadState,
}: AlertRowProps) {
  const unread = isUnreadAlert(alert);
  const navigable = isNavigableAlertDestination(alert.destination);
  const lifecycleLabel = unread ? "Mark read" : "Mark unread";

  return (
    <article
      className={cn(
        "flex flex-col gap-2 border-b border-border px-4 py-3",
        unread && "bg-primary/5",
      )}
      aria-label={`${domainAlertSeverityLabel(alert.severity)} alert: ${alert.title}`}
    >
      <div className="flex items-start gap-2">
        <HugeiconsIcon
          icon={severityIcon(alert.severity)}
          strokeWidth={2}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {navigable ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs font-medium text-foreground"
                aria-label={`Open alert: ${alert.title}`}
                onClick={() => onOpen?.()}
                disabled={isLifecyclePending}
              >
                {alert.title}
              </Button>
            ) : (
              <p className="text-xs font-medium text-foreground">{alert.title}</p>
            )}
            {unread ? (
              <Badge variant="secondary" className="rounded-none px-1.5 py-0 text-[10px]">
                New
              </Badge>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            <span className="sr-only">Severity: </span>
            {domainAlertSeverityLabel(alert.severity)}
            <span aria-hidden> · </span>
            <time dateTime={alert.createdAt}>{formatAlertCreatedAt(alert.createdAt)}</time>
            {!unread ? (
              <>
                <span aria-hidden> · </span>
                <span>Read</span>
              </>
            ) : (
              <>
                <span aria-hidden> · </span>
                <span>Unread</span>
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={`${lifecycleLabel}: ${alert.title}`}
          disabled={isLifecyclePending}
          onClick={() => onToggleReadState?.()}
        >
          {lifecycleLabel}
        </Button>
      </div>
      <p className="text-xs/relaxed text-foreground">{alert.body}</p>
      {lifecycleError ? (
        <p className="text-xs text-destructive" role="alert">
          {lifecycleError}
        </p>
      ) : null}
      {destinationFeedback ? (
        <p className="text-xs text-muted-foreground" role="status">
          {destinationFeedback}
        </p>
      ) : null}
    </article>
  );
}
