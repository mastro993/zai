import getPortalRoot from "@/utils/getPortalRoot";
import { get } from "lodash";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Handler } from "./types";

type ModalContextType = {
  isOpen: boolean;
  nodeId: string;
  modalNode: React.ReactNode;
  setModalNode: React.Dispatch<React.SetStateAction<React.ReactNode>>;
  onPresent: (
    node: React.ReactNode,
    newNodeId: string,
    closeOverlayClick: boolean
  ) => void;
  onDismiss: Handler;
};

export const ModalContext = createContext<ModalContextType>({
  isOpen: false,
  nodeId: "",
  modalNode: null,
  setModalNode: () => null,
  onPresent: () => null,
  onDismiss: () => null,
});

export const ModalProvider = ({ children }: PropsWithChildren) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalNode, setModalNode] = useState<React.ReactNode>();
  const [nodeId, setNodeId] = useState("");
  const [closeOnOverlayClick, setCloseOnOverlayClick] = useState(true);

  const handlePresent = useCallback(
    (node: React.ReactNode, newNodeId: string, closeOverlayClick: boolean) => {
      setModalNode(node);
      setIsOpen(true);
      setNodeId(newNodeId);
      setCloseOnOverlayClick(closeOverlayClick);
    },
    []
  );

  const handleDismiss = useCallback(() => {
    setModalNode(undefined);
    setIsOpen(false);
    setNodeId("");
    setCloseOnOverlayClick(true);
  }, []);

  const handleOverlayDismiss = useCallback(() => {
    if (closeOnOverlayClick) {
      const customOnDismiss = get(modalNode, "props.customOnDismiss") as any;
      customOnDismiss?.();
      handleDismiss();
    }
  }, [closeOnOverlayClick, handleDismiss, modalNode]);

  const portal = useMemo(() => getPortalRoot(), []);

  const providerValue = useMemo(() => {
    return {
      isOpen,
      nodeId,
      modalNode,
      setModalNode,
      onPresent: handlePresent,
      onDismiss: handleDismiss,
    };
  }, [isOpen, nodeId, modalNode, setModalNode, handlePresent, handleDismiss]);

  return (
    <ModalContext.Provider value={providerValue}>
      {portal &&
        createPortal(
          <>
            {React.isValidElement(modalNode) &&
              React.cloneElement(modalNode, {
                // @ts-ignore
                onDismiss: handleDismiss,
              })}
          </>,
          portal
        )}
      {children}
    </ModalContext.Provider>
  );
};
