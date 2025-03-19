import { cn } from "@/utils/style";
import { TransactionCategory, TransactionCategoryColor } from "../schema";

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color" | "parent">;
};

export const TransactionCategoryBadge = ({
  category,
}: TransactionCategoryBadgeProps) => {
  const { name, color = "white" } = category;
  const variant = colorVariants[color];

  return (
    <span
      className={cn([
        "inline-flex items-center",
        "px-2 py-1",
        "rounded-md ring-1",
        "text-xs font-medium",
        variant.bg,
        variant.text,
        variant.ring,
      ])}
    >
      {name}
    </span>
  );
};

type ColorVariant = {
  bg: string;
  text: string;
  ring: string;
};

const colorVariants: Record<TransactionCategoryColor, ColorVariant> = {
  red: {
    bg: "bg-red-500 dark:bg-red-600/20",
    text: "text-red-50 dark:text-red-500",
    ring: "ring-red-600 dark:ring-red-500/40",
  },
  orange: {
    bg: "bg-orange-500 dark:bg-orange-600/20",
    text: "text-orange-50 dark:text-orange-500",
    ring: "ring-orange-600 dark:ring-orange-500/40",
  },
  amber: {
    bg: "bg-amber-500 dark:bg-amber-600/20",
    text: "text-amber-50 dark:text-amber-500",
    ring: "ring-amber-600 dark:ring-amber-500/40",
  },
  yellow: {
    bg: "bg-yellow-500 dark:bg-yellow-600/20",
    text: "text-yellow-50 dark:text-yellow-500",
    ring: "ring-yellow-600 dark:ring-yellow-500/40",
  },
  lime: {
    bg: "bg-lime-500 dark:bg-lime-600/20",
    text: "text-lime-50 dark:text-lime-500",
    ring: "ring-lime-600 dark:ring-lime-500/40",
  },
  green: {
    bg: "bg-green-500 dark:bg-green-600/20",
    text: "text-green-50 dark:text-green-500",
    ring: "ring-green-600 dark:ring-green-500/40",
  },
  emerald: {
    bg: "bg-emerald-500 dark:bg-emerald-600/20",
    text: "text-emerald-50 dark:text-emerald-500",
    ring: "ring-emerald-600 dark:ring-emerald-500/40",
  },
  teal: {
    bg: "bg-teal-500 dark:bg-teal-600/20",
    text: "text-teal-50 dark:text-teal-500",
    ring: "ring-teal-600 dark:ring-teal-500/40",
  },
  cyan: {
    bg: "bg-cyan-500 dark:bg-cyan-600/20",
    text: "text-cyan-50 dark:text-cyan-500",
    ring: "ring-cyan-600 dark:ring-cyan-500/40",
  },
  sky: {
    bg: "bg-sky-500 dark:bg-sky-600/20",
    text: "text-sky-50 dark:text-sky-500",
    ring: "ring-sky-600 dark:ring-sky-500/40",
  },
  blue: {
    bg: "bg-blue-500 dark:bg-blue-600/20",
    text: "text-blue-50 dark:text-blue-500",
    ring: "ring-blue-600 dark:ring-blue-500/40",
  },
  indigo: {
    bg: "bg-indigo-500 dark:bg-indigo-600/20",
    text: "text-indigo-50 dark:text-indigo-500",
    ring: "ring-indigo-600 dark:ring-indigo-500/40",
  },
  violet: {
    bg: "bg-violet-500 dark:bg-violet-600/20",
    text: "text-violet-50 dark:text-violet-500",
    ring: "ring-violet-600 dark:ring-violet-500/40",
  },
  purple: {
    bg: "bg-purple-500 dark:bg-purple-600/20",
    text: "text-purple-50 dark:text-purple-500",
    ring: "ring-purple-600 dark:ring-purple-500/40",
  },
  fuchsia: {
    bg: "bg-fuchsia-500 dark:bg-fuchsia-600/20",
    text: "text-fuchsia-50 dark:text-fuchsia-500",
    ring: "ring-fuchsia-600 dark:ring-fuchsia-500/40",
  },
  pink: {
    bg: "bg-pink-500 dark:bg-pink-600/20",
    text: "text-pink-50 dark:text-pink-500",
    ring: "ring-pink-600 dark:ring-pink-500/40",
  },
  rose: {
    bg: "bg-rose-500 dark:bg-rose-600/20",
    text: "text-rose-50 dark:text-rose-500",
    ring: "ring-rose-600 dark:ring-rose-500/40",
  },
  white: {
    bg: "bg-white dark:bg-white/10",
    text: "text-black/70 dark:text-white",
    ring: "ring-black/10 dark:ring-white/20",
  },
  neutral: {
    bg: "bg-neutral-500 dark:bg-white/10",
    text: "text-neutral-50 dark:text-base-content",
    ring: "ring-neutral-600 dark:ring-base-content/20",
  },
  black: {
    bg: "bg-black dark:bg-neutral-600/20",
    text: "text-white dark:text-neutral-500",
    ring: "ring-neutral-700/40 dark:ring-neutral-500/40",
  },
} as const;
