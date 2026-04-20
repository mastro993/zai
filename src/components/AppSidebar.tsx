import {
  ArrowLeftRightIcon,
  BarChartIcon,
  Book01Icon,
  ChartCandlestickIcon,
  ChartLineData01Icon,
  HelpCircleIcon,
  Home01Icon,
  Megaphone01Icon,
  PiggyBankIcon,
  Settings01Icon,
  Tag01Icon,
  TagsIcon,
  Wallet01Icon,
  type IconSvgElement,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { cn as cx } from "@heroui/react";

const data: {
  navMain: {
    title: string;
    url: string;
    items: { title: string; href: string; icon: IconSvgElement }[];
  }[];
  navFooter: { title: string; href: string; icon: IconSvgElement }[];
} = {
  navMain: [
    {
      title: "Sections",
      url: "#",
      items: [
        {
          title: "Home",
          href: "/",
          icon: Home01Icon,
        },
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: ChartLineData01Icon,
        },
        {
          title: "Accounts",
          href: "/accounts",
          icon: Wallet01Icon,
        },
        {
          title: "Portfolio",
          href: "/portfolio",
          icon: ChartCandlestickIcon,
        },
        {
          title: "Transactions",
          href: "/transactions",
          icon: ArrowLeftRightIcon,
        },
        {
          title: "Categories",
          href: "/transactions/categories",
          icon: Tag01Icon,
        },
        {
          title: "Tags",
          href: "/transactions/tags",
          icon: TagsIcon,
        },
        {
          title: "Reports",
          href: "/reports",
          icon: BarChartIcon,
        },
        {
          title: "Events",
          href: "/events",
          icon: Megaphone01Icon,
        },
        {
          title: "Budgets",
          href: "/budgets",
          icon: PiggyBankIcon,
        },
      ],
    },
  ],
  navFooter: [
    {
      title: "Documentation",
      href: "/documentation",
      icon: Book01Icon,
    },
    {
      title: "Support",
      href: "/support",
      icon: HelpCircleIcon,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings01Icon,
    },
  ],
};

function SidebarLogo() {
  return (
    <div
      className={cx([
        "px-2 transition-[padding] duration-200 ease-in-out text-3xl text-primary",
        "group-data-[collapsible=icon]:px-2",
      ])}
    >
      財
    </div>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 max-md:mt-2 mb-2 justify-center">
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent className="-mt-2">
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item) => (
          <SidebarGroup key={item.title}>
            <SidebarGroupLabel className="uppercase text-muted-foreground/65">
              {item.title}
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-2">
              <SidebarMenu>
                <SidebarItems items={item.items} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarItems items={data.navFooter} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarItems({ items }: { items: any[] }) {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();

  return items.map((item) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        className="group/menu-button group-data-[collapsible=icon]:px-[6px]! font-medium gap-3 h-9 [&>svg]:size-auto"
        isActive={matchRoute({ to: item.href }) !== false}
        onClick={() => navigate({ to: item.href })}
      >
        <a href={"#"}>
          {item.icon && (
            <Icon
              icon={item.icon}
              className="text-muted-foreground/65 group-data-[active=true]/menu-button:text-primary"
              size={18}
              aria-hidden="true"
            />
          )}
          <span>{item.title}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}
