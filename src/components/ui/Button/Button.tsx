import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type BaseButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
>;

type ButtonProps = BaseButtonProps & {
  label?: string;
  onClick?: () => void;
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "ghost"
    | "link"
    | "neutral"
    | "soft";
  size?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isLoading?: boolean;
};

export const Button = (props: ButtonProps) => {
  const variantClass = variantClasses[props.variant || "soft"];
  const sizeClass = sizeClasses[props.size || "md"];

  return (
    <button
      className={cn("btn", variantClass, sizeClass, props.className)}
      {...props}
    >
      {props.leftIcon && props.leftIcon}
      <motion.div
        className={cn(["flex-1"])}
        initial={{ opacity: 1 }}
        animate={{ opacity: props.isLoading ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        {props.label}
      </motion.div>
      {props.rightIcon && props.rightIcon}
      <motion.span
        className="loading loading-spinner loading-xs absolute"
        initial={{ opacity: 0 }}
        animate={{ opacity: props.isLoading ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </button>
  );
};

const variantClasses = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  ghost: "btn-ghost",
  link: "btn-link",
  neutral: "btn-neutral",
  soft: "btn-soft",
};

const sizeClasses = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};
