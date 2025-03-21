import { InjectedModalProps, Modal, useModal } from "@/components/Modal";
import { cn } from "@/utils/style";
import { useCallback } from "react";

type ModalConfig = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onDismiss?: () => void;
  destructive?: boolean;
};

export const useConfirmationModal = ({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm = () => {},
  onDismiss = () => {},
  destructive = false,
}: ModalConfig) => {
  const InnerModal: React.FC = useCallback(
    (props: InjectedModalProps) => (
      <Modal title={title} description={description} {...props}>
        <form method="dialog" className="modal-action">
          <button className="btn btn-soft" onClick={onDismiss}>
            {cancelText}
          </button>
          <button
            className={cn("btn", destructive && "btn-error")}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </form>
      </Modal>
    ),
    [title, description, confirmText, cancelText, onConfirm, onDismiss]
  );

  return useModal(<InnerModal />);
};
