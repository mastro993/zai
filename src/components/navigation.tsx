import { Input } from "@heroui/input";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import {
  ArrowLeftRight,
  BarChart,
  Book,
  ChartCandlestick,
  DollarSign,
  Ellipsis,
  HelpCircle,
  Home,
  LineChart,
  Megaphone,
  PiggyBank,
  Plus,
  SearchIcon,
  Settings,
  Tag,
  Tags,
  Wallet,
} from "lucide-react";

import { useMatchRoute } from "@tanstack/react-router";
import { cn as cx } from "@heroui/react";
import {
  Sidebar as InternalSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";

const data = {
  navMain: [
    {
      title: "Sections",
      url: "#",
      items: [
        {
          title: "Home",
          href: "/",
          icon: Home,
        },
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LineChart,
        },
        {
          title: "Accounts",
          href: "/accounts",
          icon: Wallet,
        },
        {
          title: "Portfolio",
          href: "/portfolio",
          icon: ChartCandlestick,
        },
        {
          title: "Transactions",
          href: "/transactions",
          icon: ArrowLeftRight,
        },
        {
          title: "Categories",
          href: "/transactions/categories",
          icon: Tag,
        },
        {
          title: "Tags",
          href: "/transactions/tags",
          icon: Tags,
        },
        {
          title: "Reports",
          href: "/reports",
          icon: BarChart,
        },
        {
          title: "Events",
          href: "/events",
          icon: Megaphone,
        },
        {
          title: "Budgets",
          href: "/budgets",
          icon: PiggyBank,
        },
      ],
    },
  ],
  navFooter: [
    {
      title: "Documentation",
      href: "/documentation",
      icon: Book,
    },
    {
      title: "Support",
      href: "/support",
      icon: HelpCircle,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ],
};

export const Sidebar = () => {
  const { state } = useSidebar();

  const matchRoute = useMatchRoute();

  return (
    <InternalSidebar collapsible="icon" side="left">
      <SidebarContent>
        <SidebarHeader>
          <Link
            className="text-xl font-bold p-2 transition-opacity duration-200 flex gap-2 items-center"
            href="/"
          >
            <div
              className={cx([
                "px-2 transition-[padding] duration-200 ease-in-out text-3xl text-primary",
                "group-data-[collapsible=icon]:px-2",
              ])}
            >
              財
            </div>
            {state === "expanded" && <p className="font-bold text-inherit">Zai</p>}
          </Link>
        </SidebarHeader>

        <SidebarMenu className="gap-3">
          <SidebarMenuItem>
            <Input
              aria-label="Search"
              classNames={{
                inputWrapper: "bg-default-100",
                input: "text-sm",
              }}
              endContent={
                <Kbd className="hidden lg:inline-block" keys={["command"]}>
                  K
                </Kbd>
              }
              labelPlacement="outside"
              placeholder="Search..."
              startContent={
                <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
              }
              type="search"
            />
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              as={Link}
              href="/docs"
              isActive={matchRoute({ to: "/" }) !== false}
              tooltip="Docs"
            >
              <Book />
              <span>Docs</span>
            </SidebarMenuButton>
            <SidebarMenuBadge>4</SidebarMenuBadge>
          </SidebarMenuItem>

          {Array.from({ length: 3 }).map((_, index) => (
            <SidebarMenuItem key={index}>
              <SidebarMenuSkeleton />
            </SidebarMenuItem>
          ))}

          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Application</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add Project">
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  href="/pricing"
                  isActive={matchRoute({ to: "/" }) !== false}
                  tooltip="Kanban"
                >
                  <DollarSign />
                  <span>Pricing</span>
                </SidebarMenuButton>
                <SidebarMenuAction>
                  <Ellipsis />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings />
              <span>Public</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  as={Link}
                  href="/blog"
                  isActive={matchRoute({ to: "/" }) !== false}
                >
                  Blog
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  as={Link}
                  href="/about"
                  isActive={matchRoute({ to: "/" }) !== false}
                >
                  About
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarFooter>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings />
              <span>Public</span>
            </SidebarMenuButton>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  as={Link}
                  href="/blog"
                  isActive={matchRoute({ to: "/" }) !== false}
                >
                  Blog
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  as={Link}
                  href="/about"
                  isActive={matchRoute({ to: "/" }) !== false}
                >
                  About
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </SidebarMenuItem>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </InternalSidebar>
  );
};
