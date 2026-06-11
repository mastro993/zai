import { Button, Tooltip, cn } from "@heroui/react";
import {
  ArrowLeftRightIcon,
  BarChartIcon,
  Book01Icon,
  ChartCandlestickIcon,
  ChartLineData01Icon,
  HelpCircleIcon,
  Home01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PiggyBankIcon,
  Settings01Icon,
  Tag01Icon,
  TagsIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { Icon, type IconProps } from "@/components/ui/icon";

type IconSvgElement = IconProps["icon"];
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

type NavItem = {
  title: string;
  href: string;
  icon: IconSvgElement;
};

const navMain: NavItem[] = [
  { title: "Home", href: "/", icon: Home01Icon },
  { title: "Dashboard", href: "/dashboard", icon: ChartLineData01Icon },
  { title: "Accounts", href: "/accounts", icon: Wallet01Icon },
  { title: "Portfolio", href: "/portfolio", icon: ChartCandlestickIcon },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRightIcon },
  { title: "Categories", href: "/transactions/categories", icon: Tag01Icon },
  { title: "Tags", href: "/transactions/tags", icon: TagsIcon },
  { title: "Reports", href: "/reports", icon: BarChartIcon },
  { title: "Budgets", href: "/budgets", icon: PiggyBankIcon },
];

const navFooter: NavItem[] = [
  { title: "Documentation", href: "/documentation", icon: Book01Icon },
  { title: "Support", href: "/support", icon: HelpCircleIcon },
  { title: "Settings", href: "/settings", icon: Settings01Icon },
];

function SidebarNavItem({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isActive = matchRoute({ to: item.href }) !== false;

  const button = (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "w-full h-9 gap-3 font-medium transition-all duration-200",
        expanded ? "justify-start px-3" : "justify-center px-0",
      )}
      onPress={() => navigate({ to: item.href })}
    >
      <Icon
        icon={item.icon}
        size={18}
        className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )}
      />
      {expanded && <span className="truncate text-sm">{item.title}</span>}
    </Button>
  );

  if (!expanded) {
    return (
      <Tooltip delay={300}>
        <Tooltip.Trigger>{button}</Tooltip.Trigger>
        <Tooltip.Content placement="right">
          <p>{item.title}</p>
        </Tooltip.Content>
      </Tooltip>
    );
  }

  return button;
}

export const Sidebar = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-divider bg-background shrink-0",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        expanded ? "w-56" : "w-14",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-2 h-14 shrink-0",
          expanded ? "px-4" : "justify-center px-0",
        )}
      >
        <span className="text-3xl leading-none text-primary select-none">財</span>
        {expanded && <span className="font-bold text-lg leading-none">Zai</span>}
      </div>

      {/* Main nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto">
        {navMain.map((item) => (
          <SidebarNavItem key={item.href} item={item} expanded={expanded} />
        ))}
      </nav>

      {/* Footer nav + toggle */}
      <div className="flex flex-col gap-0.5 px-2 py-2 border-t border-divider">
        {navFooter.map((item) => (
          <SidebarNavItem key={item.href} item={item} expanded={expanded} />
        ))}

        <Tooltip delay={300}>
          <Tooltip.Trigger>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full h-9 gap-3 font-medium mt-1",
                expanded ? "justify-start px-3" : "justify-center px-0",
              )}
              onPress={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Icon
                icon={expanded ? PanelLeftCloseIcon : PanelLeftOpenIcon}
                size={18}
                className="shrink-0 text-muted-foreground"
              />
              {expanded && <span className="truncate text-sm text-muted-foreground">Collapse</span>}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content placement="right">
            <p>{expanded ? "Collapse" : "Expand"}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </aside>
  );
};
