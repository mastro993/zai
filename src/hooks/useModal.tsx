import { cn } from "@/utils/style";
import { useCallback, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

type ModalButton = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "accent" | "ghost" | "link";
};

type ModalConfig = {
  title: string;
  content: React.ReactNode;
  buttons: ModalButton[];
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
};

type UseModalReturn = {
  openModal: () => void;
  closeModal: () => void;
  Modal: React.FC;
};

export const useModal = (config: ModalConfig): UseModalReturn => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openModal = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const closeModal = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useHotkeys("Escape", closeModal);

  const Modal: React.FC = useCallback(() => {
    return (
      <dialog
        ref={dialogRef}
        className={cn(
          "modal modal-bottom sm:modal-middle",
          "backdrop:bg-black/50"
        )}
        onClick={(e) => {
          if (config.closeOnBackdropClick && e.target === e.currentTarget) {
            closeModal();
          }
        }}
      >
        <div className={cn("modal-box")}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{config.title}</h3>
            {config.showCloseButton && (
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={closeModal}
              >
                ✕
              </button>
            )}
          </div>
          <div className="py-4">{config.content}</div>
          <div className="modal-action">
            <form method="dialog">
              {config.buttons.map((button, index) => (
                <button
                  key={index}
                  className={cn(
                    "btn",
                    button.variant && `btn-${button.variant}`
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    button.onClick();
                  }}
                >
                  {button.label}
                </button>
              ))}
            </form>
          </div>
        </div>
      </dialog>
    );
  }, [config, closeModal]);

  return { openModal, closeModal, Modal };
};
