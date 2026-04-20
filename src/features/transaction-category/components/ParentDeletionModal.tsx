import { Button, Modal } from "@heroui/react";
import { useMemo, useState } from "react";
import type { TransactionCategory } from "../types";
import { TransactionCategoryBadge } from "./TransactionCategoryBadge";

export type ParentDeletionModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  parentCategory: TransactionCategory;
  children: TransactionCategory[];
  availableParents: TransactionCategory[];
  onConfirm: (reassignments: Record<string, string | null>) => Promise<void>;
  isLoading?: boolean;
};

/**
 * Modal for reassigning children when their parent is being deleted.
 * Shows all children and allows user to select a new parent for each, or set to null (root).
 */
export function ParentDeletionModal({
  isOpen,
  onOpenChange,
  parentCategory,
  children,
  availableParents,
  onConfirm,
  isLoading = false,
}: ParentDeletionModalProps) {
  const [reassignments, setReassignments] = useState<Record<string, string | null>>({});

  // Initialize reassignments with current parent (to be changed)
  useMemo(() => {
    const initial: Record<string, string | null> = {};
    children.forEach((child) => {
      initial[child.id] = null; // Default to null (root)
    });
    setReassignments(initial);
  }, [children]);

  const allChildrenAssigned = children.every((child) => reassignments[child.id] !== undefined);

  const handleConfirm = async () => {
    if (!allChildrenAssigned) return;
    await onConfirm(reassignments);
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Reassign Children</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-foreground/60">
                  The category <strong>{parentCategory.name}</strong> has {children.length}{" "}
                  {children.length === 1 ? "child" : "children"}. Please reassign them before deletion:
                </p>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {children.map((child) => (
                  <div key={child.id} className="space-y-2 p-3 bg-sidebar rounded-md">
                    <div className="flex items-center gap-2 mb-3">
                      <TransactionCategoryBadge category={child} />
                      <span className="text-sm font-medium">{child.name}</span>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-foreground/60">Assign new parent:</label>
                      <select
                        className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-md text-sm"
                        value={reassignments[child.id] ?? ""}
                        onChange={(e) => {
                          setReassignments((prev) => ({
                            ...prev,
                            [child.id]: e.target.value || null,
                          }));
                        }}
                      >
                        <option value="">Make this a root category</option>
                        {availableParents
                          .filter((p) => p.id !== parentCategory.id && p.id !== child.id)
                          .map((parent) => (
                            <option key={parent.id} value={parent.id}>
                              {parent.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-2">
                <Button
                  onPress={handleConfirm}
                  isDisabled={!allChildrenAssigned || isLoading}
                  className="w-full"
                >
                  {isLoading ? "Deleting..." : "Confirm & Delete Parent"}
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => onOpenChange(false)}
                  isDisabled={isLoading}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
