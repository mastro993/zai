import { useEffect, useReducer, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Blockchain01Icon,
  CodeIcon,
  Moon02Icon,
  RefreshIcon,
  Settings01Icon,
  Sun01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Result } from "@praha/byethrow";
import { useTheme } from "next-themes";

import {
  STATUS_BAR_CURRENT_FEEDBACK_MS,
  STATUS_BAR_DEV_FAKE_CHECK_MS,
  isStatusBarVersionInteractive,
  reduceStatusBarUpdateIconPhase,
} from "@/components/status-bar-update-icon";
import { toast } from "@/components/toaster/toast";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { aboutPackageVersion, resolveAboutAppVersion } from "@/features/settings/lib/about-info";
import { useOpenSettings } from "@/features/settings/hooks/use-settings-modal";
import {
  checkForUpdates,
  isUpdaterAvailable,
  isUpdaterTarget,
  readUpdateChannel,
  type UpdaterTarget,
} from "@/features/settings/lib/updater";
import { settingsItem } from "@/lib/navigation";
import { applyStatusBarTheme, nextStatusBarTheme } from "@/lib/theme-toggle";

const statusBarControlClassName =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";

const statusBarVersionRowClassName = "flex min-w-0 items-center gap-1 text-xs tabular-nums";

function ThemeToggle() {
  const { resolvedTheme, setTheme, systemTheme } = useTheme();
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
      onClick={() => {
        const resolved = resolvedTheme === "dark" ? "dark" : "light";
        const system = systemTheme === "dark" ? "dark" : "light";
        applyStatusBarTheme(nextStatusBarTheme(resolved, system), setTheme);
      }}
    >
      <HugeiconsIcon icon={isDark ? Moon02Icon : Sun01Icon} strokeWidth={2} />
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

function resolveStatusBarUpdaterTarget(
  buildTarget: string | undefined,
  packageVersion: string,
  updaterTarget: string | undefined,
): UpdaterTarget | null {
  if (!isUpdaterAvailable(buildTarget, packageVersion, updaterTarget)) {
    return null;
  }
  if (!isUpdaterTarget(updaterTarget)) {
    return null;
  }
  return updaterTarget;
}

interface StatusBarVersionProps {
  appVersion: string;
  updaterTarget: UpdaterTarget | null;
}

function StatusBarVersion({ appVersion, updaterTarget }: StatusBarVersionProps) {
  const [phase, dispatch] = useReducer(reduceStatusBarUpdateIconPhase, "idle");
  const fakeCheckTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "current") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      dispatch({ type: "current-feedback-expired" });
    }, STATUS_BAR_CURRENT_FEEDBACK_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (fakeCheckTimeoutRef.current !== null) {
        window.clearTimeout(fakeCheckTimeoutRef.current);
      }
    };
  }, []);

  const versionLabel = `Version ${appVersion}`;
  const versionText = <span className="truncate leading-none">{appVersion}</span>;

  if (!isStatusBarVersionInteractive(import.meta.env.DEV, updaterTarget)) {
    return (
      <span
        className="flex min-w-0 items-center gap-1 px-1.5 text-xs leading-none text-muted-foreground tabular-nums"
        aria-label={versionLabel}
      >
        <HugeiconsIcon icon={Blockchain01Icon} strokeWidth={2} className="size-3 shrink-0" />
        {versionText}
      </span>
    );
  }

  const icon =
    phase === "checking" ? RefreshIcon : phase === "current" ? Tick02Icon : Blockchain01Icon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={`${statusBarControlClassName} ${statusBarVersionRowClassName}`}
      aria-label={versionLabel}
      aria-busy={phase === "checking"}
      onClick={() => {
        if (phase === "checking") {
          return;
        }

        dispatch({ type: "check-started" });

        if (updaterTarget === null) {
          if (fakeCheckTimeoutRef.current !== null) {
            window.clearTimeout(fakeCheckTimeoutRef.current);
          }
          fakeCheckTimeoutRef.current = window.setTimeout(() => {
            fakeCheckTimeoutRef.current = null;
            dispatch({ type: "check-completed", status: "current" });
          }, STATUS_BAR_DEV_FAKE_CHECK_MS);
          return;
        }

        void checkForUpdates(readUpdateChannel(), updaterTarget).then((result) => {
          if (Result.isFailure(result)) {
            toast.error(result.error.message);
            dispatch({ type: "check-failed" });
            return;
          }

          dispatch({ type: "check-completed", status: result.value });
        });
      }}
    >
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className={
          phase === "checking"
            ? "size-3 shrink-0 animate-spin motion-reduce:animate-none"
            : "size-3 shrink-0"
        }
      />
      {versionText}
      <span className="sr-only" role="status">
        {phase === "checking"
          ? "Checking for updates"
          : phase === "current"
            ? "Zai is up to date"
            : ""}
      </span>
    </Button>
  );
}

export function ApplicationStatusBar() {
  const packageVersion = aboutPackageVersion();
  const appVersion = resolveAboutAppVersion(packageVersion);
  const updaterTarget = resolveStatusBarUpdaterTarget(
    import.meta.env.VITE_ZAI_BUILD_TARGET,
    packageVersion,
    import.meta.env.VITE_ZAI_UPDATER_TARGET,
  );
  const openSettings = useOpenSettings();

  return (
    <footer
      data-slot="application-status-bar"
      className="relative z-40 flex h-8 shrink-0 items-center border-t border-sidebar-border bg-sidebar px-2 text-sidebar-foreground"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={statusBarControlClassName}
          aria-label={settingsItem.title}
          onClick={() => openSettings()}
        >
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
        </Button>
        <ThemeToggle />
        <Separator
          orientation="vertical"
          data-slot="status-bar-version-separator"
          className="bg-sidebar-border data-vertical:h-3 data-vertical:self-center"
        />
        <StatusBarVersion appVersion={appVersion} updaterTarget={updaterTarget} />
        {import.meta.env.DEV ? <TanStackDevtoolsButton /> : null}
      </div>
    </footer>
  );
}
