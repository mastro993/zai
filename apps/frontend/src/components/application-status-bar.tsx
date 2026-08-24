import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Blockchain01Icon,
  CodeIcon,
  Moon02Icon,
  Settings01Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { AlertsBell } from "@/features/alerts/components/alerts-bell";
import { aboutPackageVersion, resolveAboutAppVersion } from "@/features/settings/lib/about-info";
import { settingsItem } from "@/lib/navigation";

const statusBarControlClassName =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={statusBarControlClassName}
      disabled={!mounted}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <HugeiconsIcon icon={isDark ? Sun01Icon : Moon02Icon} strokeWidth={2} />
    </Button>
  );
}

function TanStackDevtoolsButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={statusBarControlClassName}
      aria-label="TanStack Devtools"
      onClick={() => {
        document
          .querySelector<HTMLButtonElement>('button[aria-label="Open TanStack Devtools"]')
          ?.click();
      }}
    >
      <HugeiconsIcon icon={CodeIcon} strokeWidth={2} />
    </Button>
  );
}

export function ApplicationStatusBar() {
  const appVersion = resolveAboutAppVersion(aboutPackageVersion());

  return (
    <footer
      data-slot="application-status-bar"
      className="relative z-[100001] flex h-8 shrink-0 items-center justify-between border-t border-sidebar-border bg-sidebar px-2 text-sidebar-foreground"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-xs"
          className={statusBarControlClassName}
          aria-label={settingsItem.title}
          render={<Link to={settingsItem.to} preload="intent" />}
        >
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
        </Button>
        <ThemeToggle />
        <span
          className="flex min-w-0 items-center gap-1 px-1.5 text-xs leading-none text-muted-foreground tabular-nums"
          aria-label={`Version ${appVersion}`}
        >
          <HugeiconsIcon icon={Blockchain01Icon} strokeWidth={2} className="size-3 shrink-0" />
          <span className="truncate leading-none">{appVersion}</span>
        </span>
        {import.meta.env.DEV ? <TanStackDevtoolsButton /> : null}
      </div>
      <div className="flex shrink-0 items-center">
        <AlertsBell />
      </div>
    </footer>
  );
}
