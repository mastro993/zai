import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

const parseToasterTheme = (value: string): NonNullable<ToasterProps["theme"]> => {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
};

export function Toaster({ className, theme: themeProp, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={themeProp ?? parseToasterTheme(theme)}
      className={cn("toaster", className)}
      position="bottom-right"
      gap={8}
      visibleToasts={3}
      offset={16}
      {...props}
    />
  );
}
