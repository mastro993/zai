import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "@/lib/utils";

export function Toaster({ className, theme: themeProp, ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={themeProp ?? (theme as ToasterProps["theme"])}
      className={cn("toaster", className)}
      position="bottom-right"
      gap={8}
      visibleToasts={3}
      offset={16}
      {...props}
    />
  );
}
