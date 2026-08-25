import { useId, useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveScreenBreadcrumbs } from "@/lib/navigation";

import { SettingsNav } from "./settings-nav";
import { useSettingsReturnHrefValue } from "../hooks/use-settings-return-href";

interface SettingsModalProps {
  children: ReactNode;
}

function SettingsModalBreadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = resolveScreenBreadcrumbs(pathname);

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

export function SettingsModal({ children }: SettingsModalProps) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnHref = useSettingsReturnHrefValue();
  const searchId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          router.history.push(returnHref);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[90dvh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw] md:flex-row"
      >
        <aside
          data-slot="settings-modal-sidebar"
          className="flex w-full shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:h-full md:w-52 md:border-r md:border-b-0"
        >
          <DialogTitle className="sr-only">Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Appearance, currencies, and about.
          </DialogDescription>
          <div
            data-slot="settings-modal-sidebar-search"
            className="flex h-12 shrink-0 items-center px-2"
          >
            <Field className="min-w-0 flex-1">
              <FieldLabel htmlFor={searchId} className="sr-only">
                Search settings
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput id={searchId} type="search" placeholder="Search settings" />
              </InputGroup>
            </Field>
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-2">
            <SettingsNav pathname={pathname} />
          </div>
        </aside>
        <div
          data-slot="settings-modal-main"
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
        >
          <header
            data-slot="settings-modal-header"
            className="relative z-30 flex h-12 shrink-0 items-center border-b border-border bg-background text-foreground"
          >
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 px-4">
              <div data-slot="settings-modal-breadcrumbs" className="min-w-0 shrink-0">
                <SettingsModalBreadcrumbs pathname={pathname} />
              </div>
            </div>
            <div
              data-slot="settings-modal-header-actions"
              className="flex shrink-0 items-center justify-end px-4"
            >
              <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
          </header>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
