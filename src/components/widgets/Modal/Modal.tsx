import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useId } from "react";
import { InjectedModalProps } from ".";

export type ModalProps = InjectedModalProps & {
  title: string;
  description?: string;
  children: React.ReactNode;
  fullScreen?: boolean;
};

export const Modal = ({
  title,
  description,
  children,
  fullScreen = false,
}: ModalProps) => {
  const uniqueModalId = useId();

  return (
    <motion.div
      id={uniqueModalId}
      className={cn([
        "z-50",
        "bg-background p-6 rounded-md border",
        "flex flex-col gap-4",
        "max-sm:w-full",
        fullScreen && "w-11/12 h-11/12 min-2xl:w-[1280px]",
      ])}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: 0.2,
        ease: "easeInOut",
      }}
    >
      <h3 className="font-bold text-lg">{title}</h3>
      {description}
      {children}
    </motion.div>
  );
};
