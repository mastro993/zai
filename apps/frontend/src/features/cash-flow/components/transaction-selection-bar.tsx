import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";

type TransactionSelectionBarProps = {
  selectedCount: number;
  isDeleting: boolean;
  onDelete: () => void;
  onClearSelection: () => void;
};

function TransactionSelectionBar({
  selectedCount,
  isDeleting,
  onDelete,
  onClearSelection,
}: TransactionSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      <ButtonGroup role="status" aria-live="polite">
        <ButtonGroupText className="font-normal tabular-nums">
          {selectedCount} selected
        </ButtonGroupText>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Clear selection"
          disabled={isDeleting}
          onClick={onClearSelection}
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </ButtonGroup>
      <Button type="button" variant="destructive" disabled={isDeleting} onClick={onDelete}>
        Delete selected
      </Button>
    </>
  );
}

export { TransactionSelectionBar };
