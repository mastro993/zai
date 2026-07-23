import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";

import type { RecurringBulkAction } from "../types/recurring-bulk";

const ACTIONS: Array<{ action: RecurringBulkAction; label: string; destructive?: boolean }> = [
  { action: "pause", label: "Pause" },
  { action: "resume", label: "Resume" },
  { action: "stop", label: "Stop", destructive: true },
  { action: "delete", label: "Delete", destructive: true },
  { action: "retryNow", label: "Retry now" },
];

export function RecurringSelectionBar({
  selectedCount,
  hiddenCount,
  frozenFilterFingerprint,
  isBusy,
  onAction,
  onClearSelection,
}: {
  selectedCount: number;
  hiddenCount: number;
  frozenFilterFingerprint?: string;
  isBusy: boolean;
  onAction: (action: RecurringBulkAction) => void;
  onClearSelection: () => void;
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="region" aria-label="Bulk selection">
      <ButtonGroup role="status" aria-live="polite">
        <ButtonGroupText className="font-normal tabular-nums">
          {selectedCount} selected
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
          {frozenFilterFingerprint ? " · filters frozen" : ""}
        </ButtonGroupText>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Clear selection"
          disabled={isBusy}
          onClick={onClearSelection}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </ButtonGroup>
      {ACTIONS.map(({ action, label, destructive }) => (
        <Button
          key={action}
          type="button"
          variant={destructive ? "destructive" : "outline"}
          size="sm"
          disabled={isBusy}
          onClick={() => onAction(action)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
