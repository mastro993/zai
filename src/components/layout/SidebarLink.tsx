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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50",
        "[&.active]:bg-gray-100 [&.active]:text-gray-900 dark:[&.active]:bg-gray-800 dark:[&.active]:text-gray-50"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-lg:hidden">{label}</span>
    </Link>
  );
};
