import { cn } from "@/utils/style";
import { useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ModalConfig = {
  title: string | React.ReactNode;
  content: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  destructive?: boolean;
};

export const useConfirmationModal = ({
  title,
  content,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm = () => true,
  destructive = false,
}: ModalConfig) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useHotkeys("Escape", () => {
    close();
  });

  const Modal: React.FC = useCallback(() => {
    return (
      <dialog
        ref={dialogRef}
        className={cn(
          "modal modal-bottom sm:modal-middle",
          "backdrop:bg-black/50"
        )}
      >
        <div className={cn("modal-box")}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <div className="py-4">{content}</div>
          <div className="modal-action">
            <form method="dialog" className="flex gap-2">
              <button className="btn btn-ghost">{cancelText}</button>
              <button
                className={cn("btn", destructive && "btn-error")}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    );
  }, [title, content, confirmText, cancelText, onConfirm, close]);

  return { open, close, Modal };
};
