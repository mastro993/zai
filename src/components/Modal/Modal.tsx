import { Dialog } from "@radix-ui/themes";
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
  const handleOnOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onDismiss?.();
    }
  };

  return (
    <Dialog.Root open={true} onOpenChange={handleOnOpenChange}>
      <Dialog.Content maxWidth="450px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {description}
        </Dialog.Description>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
};
