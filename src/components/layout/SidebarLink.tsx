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
        "[&.active]:bg-gray-100 dark:[&.active]:bg-gray-800",
        "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
        "[&.active]:text-gray-900 dark:[&.active]:text-gray-50",
        "transition-all duration-300"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-lg:hidden">{label}</span>
    </Link>
  );
};
