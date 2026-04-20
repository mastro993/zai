import { cn } from "@heroui/react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "./ui/breadcrumb";
import { SidebarTrigger } from "./ui/sidebar";

type Props = {
  title: string;
};

export const Navbar = ({ title, children }: React.PropsWithChildren<Props>) => {
  return (
    <div
      className={cn([
        "bg-background border-b border-foreground-100",
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
    </div>
  );
};
