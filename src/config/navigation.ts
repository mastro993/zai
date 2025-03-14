import {
  ArrowLeftRight,
  BarChart,
  ChartCandlestick,
  Home,
  LineChart,
  LucideIcon,
  Megaphone,
  PiggyBank,
  Tag,
  Tags,
  Wallet,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navigationItems: NavItem[] = [
  {
    label: "Home",
    href: "/",
    icon: Home,
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LineChart,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: Wallet,
  },
  {
    label: "Portfolio",
    href: "/portfolio",
    icon: ChartCandlestick,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
  },
  {
    label: "Categories",
    href: "/transactions/categories",
    icon: Tag,
  },
  {
    label: "Tags",
    href: "/transactions/tags",
    icon: Tags,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart,
  },
  {
    label: "Events",
    href: "/events",
    icon: Megaphone,
  },
  {
    label: "Budgets",
    href: "/budgets",
    icon: PiggyBank,
  },
];
