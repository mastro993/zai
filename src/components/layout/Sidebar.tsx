import { navigationItems, type NavItem } from "@/config/navigation";
import { cn } from "@/utils/style";
import { Settings } from "lucide-react";
import { SidebarLink } from "./SidebarLink";

export const Sidebar = () => {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0",
        "z-40 h-screen w-16 min-lg:w-64",
        "bg-base-100",
        "border-r border-base-300",
        "transition-all duration-300"
      )}
    >
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 p-3">
          {navigationItems.map((item: NavItem) => (
            <SidebarLink
              key={item.href}
              icon={item.icon}
              label={item.label}
              href={item.href}
            />
          ))}
        </nav>

        <div className={cn("p-4", "border-t  border-base-300")}>
          <SidebarLink icon={Settings} label="Settings" href="/settings" />
        </div>
      </div>
    </aside>
  );
};
