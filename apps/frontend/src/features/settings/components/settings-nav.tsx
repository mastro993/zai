import { Link } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";

import { buttonVariants } from "@/components/ui/button";
import { settingsGroups } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  pathname: string;
  onNavigate?: (pathname: string) => void;
}

export function SettingsNav({ pathname, onNavigate }: SettingsNavProps) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-row flex-wrap gap-1 px-2 md:flex-col md:gap-4"
    >
      {settingsGroups.map((group) => (
        <div key={group.label} className="contents md:flex md:flex-col md:gap-1">
          <p className="hidden px-2 text-xs font-medium text-muted-foreground md:block">
            {group.label}
          </p>
          <ul className="contents md:flex md:flex-col md:gap-1">
            {group.items.map((section) => {
              const isActive = pathname === section.to;

              return (
                <li key={section.to}>
                  <Link
                    to={section.to}
                    preload={onNavigate ? false : "intent"}
                    onClick={(event) => {
                      if (onNavigate) {
                        event.preventDefault();
                        onNavigate(section.to);
                      }
                    }}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "w-full justify-start text-sidebar-foreground",
                      isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <HugeiconsIcon icon={section.icon} strokeWidth={2} data-icon="inline-start" />
                    {section.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
