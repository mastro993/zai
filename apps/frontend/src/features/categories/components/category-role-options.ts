import { MoneyReceive01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";

import { getCategoryRoleLabel } from "../lib/category";
import { CATEGORY_ROLES, type CategoryRole } from "../types/model";

export interface CategoryRoleOption {
  value: CategoryRole;
  label: string;
  description: string;
  icon: typeof ShoppingBag01Icon | typeof MoneyReceive01Icon;
}

const CATEGORY_ROLE_ICONS = {
  spending: ShoppingBag01Icon,
  income: MoneyReceive01Icon,
} as const;

const CATEGORY_ROLE_DESCRIPTIONS = {
  spending: "Tracks outflows and can include refunds.",
  income: "Identifies genuine income only.",
} satisfies Record<CategoryRole, string>;

export const CATEGORY_ROLE_OPTIONS: Array<CategoryRoleOption> = CATEGORY_ROLES.map((role) => ({
  value: role,
  label: getCategoryRoleLabel(role),
  description: CATEGORY_ROLE_DESCRIPTIONS[role],
  icon: CATEGORY_ROLE_ICONS[role],
}));
