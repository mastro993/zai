import { Breadcrumbs, cn } from "@heroui/react";

type Props = {
  title: string;
  actions?: React.ReactNode;
};

export const Navbar = ({ title, children, actions }: React.PropsWithChildren<Props>) => {
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
        <Breadcrumbs>
          <Breadcrumbs.Item>{title}</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      {children}
      {actions}
    </div>
  );
};
