import { useState, type ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
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
          <div
            data-slot="settings-modal-sidebar-header"
            className="flex h-12 shrink-0 items-center px-4"
          >
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Appearance, currencies, and about.
            </DialogDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-auto py-2">
            <SettingsNav pathname={pathname} onNavigate={onNavigate} />
          </div>
          <div data-slot="settings-modal-sidebar-footer" className="mt-auto shrink-0 p-2">
            <DialogClose
              render={
                <Button variant="ghost" className="w-full justify-start text-sidebar-foreground" />
              }
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="inline-start" />
              Back to app
            </DialogClose>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
