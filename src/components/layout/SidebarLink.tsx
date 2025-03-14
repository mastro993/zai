import { cn } from "@/utils/style";
import { Link } from "@tanstack/react-router";
import { LucideIcon } from "lucide-react";

type SidebarLinkProps = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export const SidebarLink = ({ icon: Icon, label, href }: SidebarLinkProps) => {
  return (
    <Link
      to={href}
      className={cn(
        "flex items-center px-3 py-2 gap-3 rounded-lg",
        "px-3 py-2 max-lg:px-2",
        "[&.active]:bg-base-300",
        "text-content hover:text-content",
        "[&.active]:text-content",
        "transition-all duration-300"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-lg:hidden">{label}</span>
    </Link>
  );
};
