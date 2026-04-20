import { Chip, cn } from "@heroui/react";
import type { TransactionCategory, TransactionCategoryColor } from "../types";

export type TransactionCategoryBadgeVariants = {
  color: Record<TransactionCategoryColor, string>;
};

const colorClasses: Record<TransactionCategoryColor, string> = {
  red: "bg-red-700 border-red-800 text-red-100",
  orange: "bg-orange-700 border-orange-800 text-orange-100",
  yellow: "bg-yellow-700 border-yellow-800 text-yellow-100",
  green: "bg-green-700 border-green-800 text-green-100",
  teal: "bg-teal-700 border-teal-800 text-teal-100",
  sky: "bg-sky-700 border-sky-800 text-sky-100",
  blue: "bg-blue-700 border-blue-800 text-blue-100",
  indigo: "bg-indigo-700 border-indigo-800 text-indigo-100",
  purple: "bg-purple-700 border-purple-800 text-purple-100",
  pink: "bg-pink-700 border-pink-800 text-pink-100",
  neutral: "bg-neutral-700 border-neutral-800 text-neutral-100",
  "red-soft": "bg-red-200 border-red-300 ring-red-300 text-red-800",
  "orange-soft": "bg-orange-200 border-orange-300 ring-orange-300 text-orange-800",
  "yellow-soft": "bg-yellow-200 border-yellow-300 ring-yellow-300 text-yellow-600",
  "green-soft": "bg-green-200 border-green-300 ring-green-300 text-green-600",
  "teal-soft": "bg-teal-200 border-teal-300 ring-teal-300 text-teal-600",
  "sky-soft": "bg-sky-200 border-sky-300 ring-sky-300 text-sky-600",
  "blue-soft": "bg-blue-200 border-blue-300 ring-blue-300 text-blue-600",
  "indigo-soft": "bg-indigo-200 border-indigo-300 ring-indigo-300 text-indigo-600",
  "purple-soft": "bg-purple-200 border-purple-300 ring-purple-300 text-purple-600",
  "pink-soft": "bg-pink-200 border-pink-300 ring-pink-300 text-pink-600",
  "neutral-soft": "bg-neutral-200 border-neutral-300 ring-neutral-300 text-neutral-600",
};

export type TransactionCategoryBadgeProps = {
  category: Pick<TransactionCategory, "name" | "color">;
};

export const TransactionCategoryBadge = ({ category }: TransactionCategoryBadgeProps) => {
  const { name, color } = category;
  let parent: TransactionCategory | undefined; // TODO: fetch parent category if needed
  const label = [parent?.name, name].filter(Boolean).join(" • ");
  return <Chip className={cn(colorClasses[color] ?? colorClasses["neutral-soft"])}>{label}</Chip>;
};
