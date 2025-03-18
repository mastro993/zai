import { cn } from "@/utils/style";
import { X } from "lucide-react";
import { useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ModalConfig = {
  title: string;
  content: React.ReactNode;
  onClose?: () => boolean;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
};

export const useModal = ({
  title,
  content,
  onClose = () => true,
  showCloseButton = false,
  closeOnBackdropClick = true,
}: ModalConfig) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, [onClose]);

  useHotkeys("Escape", () => {
    if (onClose()) {
      close();
    }
  });

  const Modal: React.FC = useCallback(() => {
    return (
      <dialog
        ref={dialogRef}
        className={cn(
          "modal modal-bottom sm:modal-middle",
          "backdrop:bg-black/50"
        )}
        onClick={(e) => {
          if (closeOnBackdropClick && e.target === e.currentTarget) {
            if (onClose()) {
              close();
            }
          }
        }}
      >
        <div className={cn("modal-box")}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{title}</h3>
            {showCloseButton && (
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={close}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="py-4">{content}</div>
        </div>
      </dialog>
    );
  }, [title, content, showCloseButton, closeOnBackdropClick, close]);

  return { open, close, Modal };
};
