import {
  CalendarXIcon,
  ClockAlertIcon,
  DollarCircleIcon,
  Notification03Icon,
  RepeatIcon,
  Wallet03Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";
import type { HugeiconsIcon } from "@hugeicons/react";

import type { DomainAlert, DomainAlertSeverity } from "../types/domain-alert";

type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

export const ALERT_PRODUCER_KEYS = {
  budgetStatus: "budget.status",
  currencyRefreshFailure: "currency.refresh.failure",
  recurringOccurrence: "recurring.occurrence",
  recurringGenerationFailure: "recurring.generation_failure",
  recurringProcessDelay: "recurring.process_delay",
} as const;

export const alertTypeIcon = (producerKey: DomainAlert["producerKey"]): HugeIcon => {
  switch (producerKey) {
    case ALERT_PRODUCER_KEYS.budgetStatus:
      return Wallet03Icon;
    case ALERT_PRODUCER_KEYS.currencyRefreshFailure:
      return DollarCircleIcon;
    case ALERT_PRODUCER_KEYS.recurringOccurrence:
      return RepeatIcon;
    case ALERT_PRODUCER_KEYS.recurringGenerationFailure:
      return CalendarXIcon;
    case ALERT_PRODUCER_KEYS.recurringProcessDelay:
      return ClockAlertIcon;
    default:
      return Notification03Icon;
  }
};

export const alertSeverityIconClass = (severity: DomainAlertSeverity): string => {
  switch (severity) {
    case "info":
      return "bg-primary/10 text-primary";
    case "warning":
      return "bg-amber-600/10 text-amber-600 dark:text-amber-500";
    case "critical":
      return "bg-destructive/10 text-destructive";
  }
};

export const alertReadActionLabel = (unread: boolean): "Mark read" | "Mark unread" =>
  unread ? "Mark read" : "Mark unread";
