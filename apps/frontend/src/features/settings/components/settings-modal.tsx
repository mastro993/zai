import { useState, type ReactNode } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

import { SettingsNav } from "./settings-nav";
import { useSettingsReturnHrefValue } from "../hooks/use-settings-return-href";

interface SettingsModalProps {
  children: ReactNode;
}

export function SettingsModal({ children }: SettingsModalProps) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const returnHref = useSettingsReturnHrefValue();

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
      <DialogContent className="flex h-[90dvh] w-[90vw] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw]">
        <header
          data-slot="settings-modal-header"
          className="flex h-12 shrink-0 items-center border-b border-border px-4 pr-12"
        >
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">
            Appearance, currencies, and about.
          </DialogDescription>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex w-full shrink-0 flex-col gap-3 border-b border-sidebar-border bg-sidebar py-3 text-sidebar-foreground md:w-52 md:border-r md:border-b-0">
            <SettingsNav pathname={pathname} />
          </aside>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background md:pr-10">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
