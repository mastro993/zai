import {
  InjectedModalProps,
  Modal,
  useModal,
} from "@/components/widgets/Modal";
import { cn } from "@/lib/utils";

type ConfirmationModalConfig = InjectedModalProps & {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  destructive?: boolean;
};

const ConfirmationModal = (props: ConfirmationModalConfig) => {
  return (
    <Modal {...props}>
      <form method="dialog" className="modal-action">
        <button className="btn btn-soft" onClick={props.onDismiss}>
          {props.cancelText || "Cancel"}
        </button>
        <button
          className={cn("btn", props.destructive && "btn-error")}
          onClick={() => {
            props.onConfirm?.();
            props.onDismiss?.();
          }}
        >
          {props.confirmText || "Confirm"}
        </button>
      </form>
    </Modal>
  );
};

const useConfirmationModal = (props: ConfirmationModalConfig) => {
  return useModal(<ConfirmationModal {...props} />);
};

export default useConfirmationModal;
