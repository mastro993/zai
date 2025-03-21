import { navigationItems, type NavItem } from "@/config/navigation";
import { cn } from "@/utils/style";
import { Book, CircleHelp, Rocket, Settings } from "lucide-react";
import packageJson from "../../../package.json";
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
      <div className="flex h-full flex-col bg-base-200">
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

        <div className={cn("space-y-1 p-3", "border-t  border-base-300")}>
          <div className=" hidden lg:flex items-center text-base-content/50 px-3 py-2 gap-3">
            <Rocket className="size-4" />
            <span className="text-sm text-base-content/50">
              Version {packageJson.version}
            </span>
          </div>
          <SidebarLink
            icon={Book}
            label="Documentation"
            href="/documentation"
          />
          <SidebarLink icon={CircleHelp} label="Support" href="/support" />
          <SidebarLink icon={Settings} label="Settings" href="/settings" />
        </div>
      </div>
    </aside>
  );
};

export const SidebarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <main
      className={cn("flex-1 transition-all duration-300", "ml-64 max-lg:ml-16")}
    >
      <Sidebar />
      {children}
    </main>
  );
};
