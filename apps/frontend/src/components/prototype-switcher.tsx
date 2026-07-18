import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PrototypeVariantMeta {
  key: string;
  name: string;
}

interface PrototypeSwitcherProps {
  variants: Array<PrototypeVariantMeta>;
  current: string;
  className?: string;
}

type VariantKey = "A" | "B" | "C";

export function PrototypeSwitcher({ variants, current, className }: PrototypeSwitcherProps) {
  const navigate = useNavigate();
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === current),
  );
  const meta = variants[index] ?? variants[0];
  const hidden = import.meta.env.PROD;

  const cycle = (delta: number) => {
    const wrapped = (index + delta + variants.length) % variants.length;
    const next = variants[wrapped];
    if (!next) {
      return;
    }
    void navigate({
      to: "/cash-flow/recurring",
      search: { variant: next.key as VariantKey },
      replace: true,
    });
  };

  useEffect(() => {
    if (hidden) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const wrapped = (index + delta + variants.length) % variants.length;
      const next = variants[wrapped];
      if (!next) {
        return;
      }
      void navigate({
        to: "/cash-flow/recurring",
        search: { variant: next.key as VariantKey },
        replace: true,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hidden, index, navigate, variants]);

  if (hidden) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-foreground bg-background px-2 py-1.5 shadow-lg",
        className,
      )}
    >
      <Button size="icon-sm" variant="outline" type="button" onClick={() => cycle(-1)}>
        ←
      </Button>
      <span className="min-w-48 px-2 text-center text-xs font-medium tabular-nums">
        {meta?.key} — {meta?.name}
      </span>
      <Button size="icon-sm" variant="outline" type="button" onClick={() => cycle(1)}>
        →
      </Button>
    </div>
  );
}
