import { cn } from "@/lib/utils";

type BaseButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonProps = BaseButtonProps & {
  label?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "accent" | "ghost" | "link";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  hotkeys?: ReadonlyArray<string>;
  className?: string;
};

export const Button = (props: ButtonProps) => {
  const variantClass = variantClasses[props.variant || "primary"];
  const sizeClass = sizeClasses[props.size || "md"];

  // useHotkeys(props.hotkeys?.join("+"), () => props.onClick?.());

  return (
    <button
      className={cn("btn", variantClass, sizeClass, props.className)}
      {...props}
    >
      {props.icon && props.iconPosition === "left" && props.icon}
      {props.label}
      {props.icon && props.iconPosition === "right" && props.icon}
      {props.hotkeys &&
        props.hotkeys.map((hotkey) => (
          <>
            +
            <kbd className="kbd kbd-sm" key={hotkey}>
              {hotkey}
            </kbd>
          </>
        ))}
    </button>
  );
};

const variantClasses = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  accent: "btn-accent",
  ghost: "btn-ghost",
  link: "btn-link",
};

const sizeClasses = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};
