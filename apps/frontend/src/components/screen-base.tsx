import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AlertsBell } from "@/features/alerts/components/alerts-bell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useScreenBreadcrumbs } from "@/hooks/use-screen-breadcrumbs";
import { cn } from "@/lib/utils";

type ScreenBaseProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function ScreenBreadcrumbs() {
  const crumbs = useScreenBreadcrumbs();

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          const crumbKey = crumb.href ?? `current:${crumb.label}`;

          return (
            <span key={crumbKey} className="contents">
              <BreadcrumbItem
                className={
                  index < crumbs.length - 1 ? "max-w-40 truncate sm:max-w-none" : undefined
                }
              >
                {isLast || !crumb.href ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={<Link to={crumb.href} preload="intent" />}
                    className="truncate"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function ScreenBase({ actions, children, className }: ScreenBaseProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SidebarTrigger />
          <ScreenBreadcrumbs />
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          <AlertsBell />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">{children}</div>
    </div>
  );
}
