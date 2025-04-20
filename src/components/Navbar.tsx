import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "./ui/breadcrumb";
import { SidebarTrigger } from "./ui/sidebar";

type Props = {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export const Navbar = ({ title, children, actions }: Props) => {
  return (
    <div
      className={cn([
        "bg-background border-b",
        "sticky top-0 z-20",
        "px-4 py-3",
        "flex items-center justify-between",
      ])}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {children}
      {actions}
    </div>
  );
};
