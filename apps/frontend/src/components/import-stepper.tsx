import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { cn } from "@/lib/utils";

export type ImportStep = 0 | 1 | 2;

export const previousImportStep = (current: ImportStep): ImportStep => {
  if (current === 2) {
    return 1;
  }
  if (current === 1) {
    return 0;
  }
  return 0;
};

const toImportStep = (index: number): ImportStep | undefined => {
  if (index === 0 || index === 1 || index === 2) {
    return index;
  }
  return undefined;
};

const STEPS: Array<{ title: string; hint: string }> = [
  { title: "Source", hint: "Pick a CSV" },
  { title: "Map", hint: "Match columns" },
  { title: "Review", hint: "Confirm import" },
];

export function ImportStepper({
  current,
  onStepSelect,
}: {
  current: ImportStep;
  onStepSelect: (step: ImportStep) => void;
}) {
  return (
    <ol
      className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/20 p-2.5"
      aria-label="Import progress"
    >
      {STEPS.map((step, index) => {
        const status = index < current ? "done" : index === current ? "current" : "upcoming";
        const canSelect = index < current;

        return (
          <li key={step.title} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!canSelect}
              aria-current={status === "current" ? "step" : undefined}
              onClick={() => {
                const next = toImportStep(index);
                if (next !== undefined) {
                  onStepSelect(next);
                }
              }}
              className={cn(
                "group flex min-w-0 items-center gap-2 text-left outline-none",
                canSelect && "cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors",
                  status === "current" && "border-primary bg-primary text-primary-foreground",
                  status === "done" && "border-primary/30 bg-primary/10 text-primary",
                  status === "upcoming" && "border-border text-muted-foreground",
                  canSelect && "group-focus-visible:ring-1 group-focus-visible:ring-ring",
                )}
              >
                {status === "done" ? (
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={2.5} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {step.title}
                </span>
                <span className="hidden truncate text-[0.6875rem] text-muted-foreground sm:block">
                  {step.hint}
                </span>
              </span>
            </button>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 transition-colors",
                  index < current ? "bg-primary/40" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
