import { useEffect, useRef } from "react";
import { Mail01Icon, MailOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  alertReadActionLabel,
  alertSeverityIconClass,
  alertTypeIcon,
} from "../lib/alert-presentation";
import {
  domainAlertSeverityLabel,
  formatAlertCreatedAt,
  formatAlertTimestamp,
} from "../lib/format";
import { isNavigableAlertDestination, isUnreadAlert } from "../lib/parse";
import type { DomainAlert } from "../types/domain-alert";
import { BudgetStatusAlertSnapshot } from "./budget-status-alert-snapshot";

interface AlertRowProps {
  alert: DomainAlert;
  autoFocus?: boolean;
  destinationFeedback?: string | null;
  isLifecyclePending?: boolean;
  lifecycleError?: string | null;
  onOpen?: () => void;
  onToggleReadState?: () => void;
}

export function AlertRow({
  alert,
  autoFocus = false,
  destinationFeedback = null,
  isLifecyclePending = false,
  lifecycleError = null,
  onOpen,
  onToggleReadState,
}: AlertRowProps) {
  const rowRef = useRef<HTMLElement>(null);
  const unread = isUnreadAlert(alert);
  const navigable = isNavigableAlertDestination(alert.destination);
  const lifecycleLabel = alertReadActionLabel(unread);

  useEffect(() => {
    if (!autoFocus || !rowRef.current) {
      return;
    }
    rowRef.current.scrollIntoView({ block: "nearest" });
    rowRef.current.focus({ preventScroll: true });
  }, [autoFocus]);

  return (
    <article
      ref={rowRef}
      tabIndex={autoFocus ? -1 : undefined}
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${domainAlertSeverityLabel(alert.severity)} alert: ${alert.title}`}
    >
      <Item variant={unread ? "muted" : "default"} size="xs" className="items-start">
        <ItemMedia
          variant="icon"
          className={cn("size-6 rounded-md", alertSeverityIconClass(alert.severity))}
        >
          <HugeiconsIcon icon={alertTypeIcon(alert.producerKey)} strokeWidth={2} aria-hidden />
        </ItemMedia>
        <ItemContent>
          <ItemTitle className={cn("text-xs", unread && "font-semibold")}>
            {navigable ? (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-foreground"
                aria-label={`Open alert: ${alert.title}`}
                onClick={() => onOpen?.()}
                disabled={isLifecyclePending}
              >
                {alert.title}
              </Button>
            ) : (
              alert.title
            )}
          </ItemTitle>
          <ItemDescription>
            <Tooltip>
              <TooltipTrigger render={<time dateTime={alert.createdAt} />}>
                {formatAlertCreatedAt(alert.createdAt)}
              </TooltipTrigger>
              <TooltipContent>{formatAlertTimestamp(alert.createdAt)}</TooltipContent>
            </Tooltip>
          </ItemDescription>
          <p className="mt-1 text-xs text-foreground">{alert.body}</p>
          {alert.data ? <BudgetStatusAlertSnapshot data={alert.data} /> : null}
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
        </ItemContent>
        <ItemActions className="self-start">
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  pressed={unread}
                  size="sm"
                  disabled={isLifecyclePending}
                  aria-label={`${lifecycleLabel}: ${alert.title}`}
                  className={cn("px-0", unread ? "text-primary" : "text-muted-foreground")}
                  onPressedChange={() => onToggleReadState?.()}
                />
              }
            >
              {isLifecyclePending ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={unread ? Mail01Icon : MailOpen01Icon} strokeWidth={2} />
              )}
            </TooltipTrigger>
            <TooltipContent side="left">{lifecycleLabel}</TooltipContent>
          </Tooltip>
        </ItemActions>
      </Item>
    </article>
  );
}
