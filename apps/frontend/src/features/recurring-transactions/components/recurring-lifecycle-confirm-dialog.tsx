import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";

export function RecurringLifecycleConfirmDialog({
  open,
  title,
  description,
  actionLabel,
  pendingLabel,
  isPending,
  destructive = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  pendingLabel: string;
  isPending: boolean;
  destructive?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      isActionPending={isPending}
    >
      <Button
        variant={destructive ? "destructive" : "default"}
        size="sm"
        disabled={isPending}
        aria-busy={isPending}
        onClick={onConfirm}
      >
        {isPending ? pendingLabel : actionLabel}
      </Button>
    </ConfirmationDialog>
  );
}
