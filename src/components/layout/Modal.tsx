import { X } from "lucide-react";
import React from "react";

type ModalProps = {
  id: string;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
};

export const Modal = ({
  id,
  title,
  children,
  showCloseButton = false,
  closeOnBackdropClick = true,
}: ModalProps) => {
  return (
    <dialog id={id} className={"modal modal-bottom sm:modal-middle"}>
      <div className="modal-box">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          {showCloseButton && (
            <form method="dialog">
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
        <div className="py-4">{children}</div>
      </div>
      {closeOnBackdropClick && (
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      )}
    </dialog>
  );
};
