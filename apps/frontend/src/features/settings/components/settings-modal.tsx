import { useId, useState, type ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { SettingsNav } from "./settings-nav";
import { useSettingsReturnHrefValue } from "../hooks/use-settings-return-href";

interface SettingsModalProps {
  children: ReactNode;
  pathname?: string;
  onNavigate?: (pathname: string) => void;
  onClose?: () => void;
}

export function SettingsModal({
  children,
  pathname: pathnameOverride,
  onNavigate,
  onClose,
}: SettingsModalProps) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const routePathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const pathname = pathnameOverride ?? routePathname;
  const returnHref = useSettingsReturnHrefValue();
  const searchId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) {
          if (onClose) {
            onClose();
          } else {
            router.history.push(returnHref);
          }
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
            Appearance, about, diagnostics, and currencies.
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
            <SettingsNav pathname={pathname} onNavigate={onNavigate} />
          </div>
        </aside>
        <div
          data-slot="settings-modal-main"
          className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
        >
          <header
            data-slot="settings-modal-header"
            className="relative z-30 flex h-12 shrink-0 items-center justify-end border-b border-border bg-background px-4 text-foreground"
          >
            <div data-slot="settings-modal-header-actions" className="flex shrink-0 items-center">
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
