import Overlay from "@/components/Overlay";
import { useId, useLayoutEffect } from "react";
import { InjectedModalProps } from ".";

export type ModalProps = InjectedModalProps & {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export const Modal = ({
  title,
  description,
  children,
  onDismiss,
}: ModalProps) => {
  const uniqueModalId = useId();

  useLayoutEffect(() => {
    const modal = document.getElementById(
      uniqueModalId
    ) as HTMLDialogElement | null;
    modal?.showModal();
  }, [uniqueModalId]);

  return (
    <dialog
      id={uniqueModalId}
      className="modal modal-bottom sm:modal-middle select-none"
    >
      <Overlay onClick={onDismiss} />
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{description}</p>
        {children}
      </div>
    </dialog>
  );
};
