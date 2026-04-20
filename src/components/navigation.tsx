import { Input } from "@heroui/input";
import { Kbd } from "@heroui/kbd";
import { Link } from "@heroui/link";
import {
  ArrowLeftRightIcon,
  BarChartIcon,
  Book01Icon,
  ChartCandlestickIcon,
  ChartLineData01Icon,
  Dollar01Icon,
  HelpCircleIcon,
  Home01Icon,
  Megaphone01Icon,
  MoreHorizontalIcon,
  PiggyBankIcon,
  PlusSignIcon,
  Search01Icon,
  Settings01Icon,
  Tag01Icon,
  TagsIcon,
  Wallet01Icon,
  type IconSvgElement,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/icon";

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

const _data: {
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
                <Icon
                  icon={Search01Icon}
                  className="text-base text-default-400 pointer-events-none flex-shrink-0"
                />
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
              <Icon icon={Book01Icon} />
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
              <Icon icon={PlusSignIcon} />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenuItem>
                <SidebarMenuButton
                  as={Link}
                  href="/pricing"
                  isActive={matchRoute({ to: "/" }) !== false}
                  tooltip="Kanban"
                >
                  <Icon icon={Dollar01Icon} />
                  <span>Pricing</span>
                </SidebarMenuButton>
                <SidebarMenuAction>
                  <Icon icon={MoreHorizontalIcon} />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarMenuItem>
            <SidebarMenuButton>
              <Icon icon={Settings01Icon} />
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
              <Icon icon={Settings01Icon} />
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
