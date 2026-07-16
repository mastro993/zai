import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps, ReactNode } from "react";
import { toast as sonnerToast, type Action } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "info" | "warning" | "error" | "loading";

type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

type ToastNode = ReactNode | (() => ReactNode);

interface ToastItemProps {
  id: string | number;
  variant: ToastVariant;
  title: ToastNode;
  description?: ToastNode;
  action?: Action | ReactNode;
  cancel?: Action | ReactNode;
  icon?: ReactNode | null;
  closeButton?: boolean;
}

const VARIANT_ICON: Record<ToastVariant, HugeIcon | null> = {
  default: null,
  success: CheckmarkCircle02Icon,
  info: InformationCircleIcon,
  warning: Alert02Icon,
  error: MultiplicationSignCircleIcon,
  loading: Loading03Icon,
};

const VARIANT_ICON_CLASS: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-primary",
  info: "text-foreground",
  warning: "text-amber-600 dark:text-amber-500",
  error: "text-destructive",
  loading: "text-muted-foreground",
};

function resolveNode(value: ToastNode | undefined): ReactNode {
  if (typeof value === "function") {
    return value();
  }
  return value;
}

function isAction(value: Action | ReactNode): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "label" in value &&
    "onClick" in value &&
    typeof value.onClick === "function"
  );
}

function ToastActionButton({
  action,
  toastId,
  variant,
}: {
  action: Action | ReactNode;
  toastId: string | number;
  variant: "outline" | "ghost";
}) {
  if (!isAction(action)) {
    return action;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="xs"
      className="shrink-0"
      style={action.actionButtonStyle}
      onClick={(event) => {
        action.onClick(event);
        if (!event.defaultPrevented) {
          sonnerToast.dismiss(toastId);
        }
      }}
    >
      {action.label}
    </Button>
  );
}

export function ToastItem({
  id,
  variant,
  title,
  description,
  action,
  cancel,
  icon,
  closeButton = false,
}: ToastItemProps) {
  const resolvedTitle = resolveNode(title);
  const resolvedDescription = resolveNode(description);
  const defaultIcon = VARIANT_ICON[variant];
  const showIcon = icon !== null && (icon !== undefined || defaultIcon !== null);

  return (
    <div
      data-slot="toast"
      data-variant={variant}
      className={cn(
        "flex w-[356px] max-w-[calc(100vw-2rem)] items-start gap-2.5 border border-border bg-popover p-3 text-popover-foreground",
        "rounded-none shadow-xl",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {showIcon ? (
        <span
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center [&_svg]:size-4",
            VARIANT_ICON_CLASS[variant],
          )}
          aria-hidden="true"
        >
          {icon !== undefined ? (
            icon
          ) : defaultIcon !== null ? (
            <HugeiconsIcon
              icon={defaultIcon}
              strokeWidth={2}
              className={cn(variant === "loading" && "animate-spin motion-reduce:animate-none")}
            />
          ) : null}
        </span>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs font-medium text-pretty text-foreground">{resolvedTitle}</p>
        {resolvedDescription ? (
          <p className="text-xs text-pretty text-muted-foreground">{resolvedDescription}</p>
        ) : null}
      </div>

      {action || cancel || closeButton ? (
        <div className="flex shrink-0 items-center gap-1 self-center">
          {cancel ? <ToastActionButton action={cancel} toastId={id} variant="ghost" /> : null}
          {action ? <ToastActionButton action={action} toastId={id} variant="outline" /> : null}
          {closeButton ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss"
              onClick={() => sonnerToast.dismiss(id)}
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
