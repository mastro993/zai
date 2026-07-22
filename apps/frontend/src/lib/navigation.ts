import {
  DashboardSquare01Icon,
  Settings01Icon,
  TransactionHistoryIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";

export type NavigationSubItem = {
  title: string;
  to: string;
};

export type NavigationItem = {
  title: string;
  to: string;
  icon: typeof DashboardSquare01Icon;
  subItems?: Array<NavigationSubItem>;
};

export type BreadcrumbSegment = {
  label: string;
  href?: string;
};

export const navigationItems = [
  { title: "Dashboard", to: "/dashboard", icon: DashboardSquare01Icon },
  { title: "Net Worth", to: "/net-worth", icon: Wallet01Icon },
  {
    title: "Cash flow",
    to: "/cash-flow",
    icon: TransactionHistoryIcon,
    subItems: [
      { title: "Transactions", to: "/cash-flow/transactions" },
      { title: "Budgets", to: "/cash-flow/budgets" },
      { title: "Recurring", to: "/cash-flow/recurring" },
      { title: "Forecast", to: "/cash-flow/forecast" },
      { title: "Categories", to: "/cash-flow/categories" },
    ],
  },
] as const satisfies Array<NavigationItem>;

export const settingsItem = {
  title: "Settings",
  to: "/settings",
  icon: Settings01Icon,
} as const;

const normalizePathname = (pathname: string) => {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

const titleCaseSegment = (segment: string) =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const resolveScreenBreadcrumbs = (pathname: string): Array<BreadcrumbSegment> => {
  const path = normalizePathname(pathname);

  for (const item of navigationItems) {
    const itemPath = normalizePathname(item.to);

    if (path === itemPath) {
      return [{ label: item.title }];
    }

    if ("subItems" in item && item.subItems !== undefined) {
      for (const subItem of item.subItems) {
        const subPath = normalizePathname(subItem.to);

        if (path === subPath) {
          return [{ label: item.title, href: item.to }, { label: subItem.title }];
        }
      }
    }
  }

  const settingsPath = normalizePathname(settingsItem.to);

  if (path === settingsPath) {
    return [{ label: settingsItem.title }];
  }

  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Dashboard" }];
  }

  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1;

    return {
      label: titleCaseSegment(segment),
      href: isLast ? undefined : `/${segments.slice(0, index + 1).join("/")}`,
    };
  });
};
