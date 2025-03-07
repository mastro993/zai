import {
  ArrowLeftRight,
  ChartCandlestick,
  Home,
  LineChart,
  LucideIcon,
  PiggyBank,
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
    label: "Budgets",
    href: "/budgets",
    icon: PiggyBank,
  },
];
