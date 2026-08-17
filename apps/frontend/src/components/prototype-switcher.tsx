import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PrototypeSwitcherItem {
  key: string;
  name: string;
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.closest("input, textarea, select, [contenteditable='true']") !== null ||
    target.isContentEditable
  );
};

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: Array<PrototypeSwitcherItem>;
  current: string;
  onChange: (key: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      const index = variants.findIndex((item) => item.key === current);
      if (index < 0) {
        return;
      }

      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = variants[(index + delta + variants.length) % variants.length];
      if (next) {
        onChange(next.key);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, onChange, variants]);

  const currentIndex = variants.findIndex((item) => item.key === current);
  const currentVariant = variants[currentIndex] ?? variants[0];
  if (!currentVariant) {
    return null;
  }

  const cycle = (delta: number) => {
    const next = variants[(currentIndex + delta + variants.length) % variants.length];
    if (next) {
      onChange(next.key);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2",
        "border border-foreground bg-foreground px-2 py-1.5 text-background shadow-lg",
      )}
      role="navigation"
      aria-label="Prototype variants"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-background hover:bg-background/15 hover:text-background"
        aria-label="Previous variant"
        onClick={() => cycle(-1)}
      >
        ←
      </Button>
      <p className="min-w-40 px-2 text-center text-xs font-medium tabular-nums">
        {currentVariant.key} — {currentVariant.name}
      </p>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="text-background hover:bg-background/15 hover:text-background"
        aria-label="Next variant"
        onClick={() => cycle(1)}
      >
        →
      </Button>
    </div>
  );
}
