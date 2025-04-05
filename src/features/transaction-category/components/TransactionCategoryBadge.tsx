import { cn } from "@/lib/utils";
import { TransactionCategory, TransactionCategoryColor } from "../schema";

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color" | "parent">;
};

export const TransactionCategoryBadge = ({
  category,
}: TransactionCategoryBadgeProps) => {
  const { name, parent, color } = category;
  const variant = colorVariants[color ?? "neutral"];
  return (
    <span className={cn(["badge border-0", variant.bg, variant.text])}>
      {parent ? `${parent.name} • ${name}` : name}
    </span>
  );
};

type ColorVariant = {
  bg: string;
  text: string;
};

const colorVariants: Record<TransactionCategoryColor, ColorVariant> = {
  red: {
    bg: "bg-red-100 dark:bg-red-600/20",
    text: "text-red-700 dark:text-red-500",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-600/20",
    text: "text-orange-700 dark:text-orange-500",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-600/20",
    text: "text-amber-700 dark:text-amber-500",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-600/20",
    text: "text-yellow-700 dark:text-yellow-500",
  },
  lime: {
    bg: "bg-lime-100 dark:bg-lime-600/20",
    text: "text-lime-700 dark:text-lime-500",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-600/20",
    text: "text-green-700 dark:text-green-500",
  },
  emerald: {
    bg: "bg-emerald-100 dark:bg-emerald-600/20",
    text: "text-emerald-700 dark:text-emerald-500",
  },
  teal: {
    bg: "bg-teal-100 dark:bg-teal-600/20",
    text: "text-teal-700 dark:text-teal-500",
  },
  cyan: {
    bg: "bg-cyan-100 dark:bg-cyan-600/20",
    text: "text-cyan-700 dark:text-cyan-500",
  },
  sky: {
    bg: "bg-sky-100 dark:bg-sky-600/20",
    text: "text-sky-700 dark:text-sky-500",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-600/20",
    text: "text-blue-700 dark:text-blue-500",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-600/20",
    text: "text-indigo-700 dark:text-indigo-500",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-600/20",
    text: "text-violet-700 dark:text-violet-500",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-600/20",
    text: "text-purple-700 dark:text-purple-500",
  },
  fuchsia: {
    bg: "bg-fuchsia-100 dark:bg-fuchsia-600/20",
    text: "text-fuchsia-700 dark:text-fuchsia-500",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-600/20",
    text: "text-pink-700 dark:text-pink-500",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-600/20",
    text: "text-rose-700 dark:text-rose-500",
  },
  neutral: {
    bg: "bg-neutral-100 dark:bg-white/10",
    text: "text-neutral-700 dark:text-base-content",
  },
} as const;
