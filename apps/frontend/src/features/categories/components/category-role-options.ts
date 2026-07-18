import { MoneyReceive01Icon, ShoppingBag01Icon } from "@hugeicons/core-free-icons";

import type { DrawerSelectOption } from "@/components/drawer-select";

import { getCategoryRoleLabel } from "../lib/category";
import { CATEGORY_ROLES, type CategoryRole } from "../types/model";

const CATEGORY_ROLE_ICONS = {
  spending: ShoppingBag01Icon,
  income: MoneyReceive01Icon,
} as const;

const CATEGORY_ROLE_DESCRIPTIONS: Record<CategoryRole, string> = {
  spending: "Tracks outflows and can include refunds.",
  income: "Identifies genuine income only.",
};

export const CATEGORY_ROLE_OPTIONS: Array<DrawerSelectOption<CategoryRole>> = CATEGORY_ROLES.map(
  (role) => ({
    value: role,
    label: getCategoryRoleLabel(role),
    description: CATEGORY_ROLE_DESCRIPTIONS[role],
    icon: CATEGORY_ROLE_ICONS[role],
  }),
);
