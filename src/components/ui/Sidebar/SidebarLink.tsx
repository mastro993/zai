import { cn } from "@/lib/utils";
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
        "bg-base-200 hover:bg-base-300",
        "text-base-content/80 hover:text-base-content",
        "transition-all duration-300"
      )}
      activeOptions={{
        exact: true,
      }}
      activeProps={{
        className: "bg-base-300 hover:bg-base-300 text-base-content",
      }}
    >
      <Icon className="h-4 w-4" />
      <span className="max-lg:hidden">{label}</span>
    </Link>
  );
};
