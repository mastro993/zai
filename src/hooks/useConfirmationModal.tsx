import { InjectedModalProps, useModal } from "@/components/Modal";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useCallback } from "react";
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
  useHotkeys("Escape", () => {
    close();
  });

  const Modal: React.FC = useCallback(
    (props: InjectedModalProps) => {
      const handleClose = () => {
        props.onDismiss?.();
      };

      return (
        <AlertDialog.Root open={true} onOpenChange={handleClose}>
          <AlertDialog.Content maxWidth="450px">
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description size="2">
              {content}
            </AlertDialog.Description>

            <Flex gap="3" mt="4" justify="end">
              <AlertDialog.Cancel>
                <Button variant="soft" color="gray" onClick={handleClose}>
                  {cancelText}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button
                  variant="solid"
                  color={destructive ? "red" : "gray"}
                  onClick={onConfirm}
                >
                  {confirmText}
                </Button>
              </AlertDialog.Action>
            </Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      );
    },
    [title, content, confirmText, cancelText, onConfirm, close]
  );

  return useModal(<Modal />);
};
