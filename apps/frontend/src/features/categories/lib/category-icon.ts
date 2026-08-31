import {
  Airplane01Icon,
  ArrowDataTransferHorizontalIcon,
  Baby01Icon,
  BicycleIcon,
  BookOpen01Icon,
  Bread01Icon,
  Briefcase01Icon,
  Bus01Icon,
  Car01Icon,
  CatIcon,
  CharityIcon,
  ChartIncreaseIcon,
  Coffee01Icon,
  DeliveryTruck01Icon,
  DrinkIcon,
  Dumbbell01Icon,
  Film01Icon,
  FlashIcon,
  FuelStationIcon,
  GameController01Icon,
  GiftIcon,
  HairDryerIcon,
  HealthIcon,
  Home01Icon,
  Hotel01Icon,
  House01Icon,
  Invoice01Icon,
  Luggage01Icon,
  Medicine01Icon,
  Money01Icon,
  MoreHorizontalCircle01Icon,
  Mortarboard01Icon,
  MusicNote01Icon,
  ParkingAreaSquareIcon,
  PiggyBankIcon,
  RepeatIcon,
  Restaurant01Icon,
  ServingFoodIcon,
  Shield01Icon,
  Shirt01Icon,
  ShoppingBag01Icon,
  ShoppingBasket01Icon,
  SmartPhone01Icon,
  Tag01Icon,
  Ticket01Icon,
  Train01Icon,
  UserGroupIcon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";
import type { HugeiconsIcon } from "@hugeicons/react";

type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

export const CATEGORY_ICON_GROUPS = ["Food", "Lifestyle", "Travel", "Finance", "General"] as const;

export type CategoryIconGroup = (typeof CATEGORY_ICON_GROUPS)[number];

export const CATEGORY_ICON_CATALOG = [
  { key: "food", label: "Food", group: "Food", icon: ServingFoodIcon },
  { key: "groceries", label: "Groceries", group: "Food", icon: ShoppingBasket01Icon },
  { key: "dining", label: "Dining", group: "Food", icon: Restaurant01Icon },
  { key: "coffee", label: "Coffee", group: "Food", icon: Coffee01Icon },
  { key: "drinks", label: "Drinks", group: "Food", icon: DrinkIcon },
  { key: "bakery", label: "Bakery", group: "Food", icon: Bread01Icon },
  { key: "delivery", label: "Delivery", group: "Food", icon: DeliveryTruck01Icon },
  { key: "home", label: "Home", group: "Lifestyle", icon: Home01Icon },
  { key: "rent", label: "Rent", group: "Lifestyle", icon: House01Icon },
  { key: "utilities", label: "Utilities", group: "Lifestyle", icon: FlashIcon },
  { key: "phone", label: "Phone", group: "Lifestyle", icon: SmartPhone01Icon },
  { key: "internet", label: "Internet", group: "Lifestyle", icon: Wifi01Icon },
  { key: "shopping", label: "Shopping", group: "Lifestyle", icon: ShoppingBag01Icon },
  { key: "clothing", label: "Clothing", group: "Lifestyle", icon: Shirt01Icon },
  { key: "health", label: "Health", group: "Lifestyle", icon: HealthIcon },
  { key: "pharmacy", label: "Pharmacy", group: "Lifestyle", icon: Medicine01Icon },
  { key: "fitness", label: "Fitness", group: "Lifestyle", icon: Dumbbell01Icon },
  { key: "beauty", label: "Beauty", group: "Lifestyle", icon: HairDryerIcon },
  { key: "education", label: "Education", group: "Lifestyle", icon: Mortarboard01Icon },
  { key: "books", label: "Books", group: "Lifestyle", icon: BookOpen01Icon },
  { key: "entertainment", label: "Entertainment", group: "Lifestyle", icon: Ticket01Icon },
  { key: "gaming", label: "Gaming", group: "Lifestyle", icon: GameController01Icon },
  { key: "music", label: "Music", group: "Lifestyle", icon: MusicNote01Icon },
  { key: "movies", label: "Movies", group: "Lifestyle", icon: Film01Icon },
  { key: "subscriptions", label: "Subscriptions", group: "Lifestyle", icon: RepeatIcon },
  { key: "transport", label: "Transport", group: "Travel", icon: Bus01Icon },
  { key: "car", label: "Car", group: "Travel", icon: Car01Icon },
  { key: "fuel", label: "Fuel", group: "Travel", icon: FuelStationIcon },
  { key: "parking", label: "Parking", group: "Travel", icon: ParkingAreaSquareIcon },
  { key: "bicycle", label: "Bicycle", group: "Travel", icon: BicycleIcon },
  { key: "train", label: "Train", group: "Travel", icon: Train01Icon },
  { key: "flight", label: "Flight", group: "Travel", icon: Airplane01Icon },
  { key: "hotel", label: "Hotel", group: "Travel", icon: Hotel01Icon },
  { key: "travel", label: "Travel", group: "Travel", icon: Luggage01Icon },
  { key: "taxes", label: "Taxes", group: "Finance", icon: Invoice01Icon },
  { key: "insurance", label: "Insurance", group: "Finance", icon: Shield01Icon },
  { key: "savings", label: "Savings", group: "Finance", icon: PiggyBankIcon },
  { key: "investments", label: "Investments", group: "Finance", icon: ChartIncreaseIcon },
  { key: "salary", label: "Salary", group: "Finance", icon: Money01Icon },
  { key: "business", label: "Business", group: "Finance", icon: Briefcase01Icon },
  { key: "transfer", label: "Transfer", group: "Finance", icon: ArrowDataTransferHorizontalIcon },
  { key: "default", label: "Default", group: "General", icon: Tag01Icon },
  { key: "other", label: "Other", group: "General", icon: MoreHorizontalCircle01Icon },
  { key: "gifts", label: "Gifts", group: "General", icon: GiftIcon },
  { key: "charity", label: "Charity", group: "General", icon: CharityIcon },
  { key: "family", label: "Family", group: "General", icon: UserGroupIcon },
  { key: "childcare", label: "Childcare", group: "General", icon: Baby01Icon },
  { key: "pets", label: "Pets", group: "General", icon: CatIcon },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  group: CategoryIconGroup;
  icon: HugeIcon;
}>;

export type CategoryIcon = (typeof CATEGORY_ICON_CATALOG)[number]["key"];

const mappedCategoryIcons = CATEGORY_ICON_CATALOG.map((entry) => entry.key);
const firstCategoryIcon = mappedCategoryIcons[0] ?? "default";
// SAFETY: catalog is a non-empty const of CategoryIcon keys; map preserves that union
// and the fallback is itself a CategoryIcon.
export const CATEGORY_ICONS: [CategoryIcon, ...Array<CategoryIcon>] = [
  firstCategoryIcon,
  ...mappedCategoryIcons.slice(1),
];

export const DEFAULT_CATEGORY_ICON = "default" satisfies CategoryIcon;

const catalogByKey = new Map(CATEGORY_ICON_CATALOG.map((entry) => [entry.key, entry]));
const categoryIconSet = new Set<string>(CATEGORY_ICONS);

export const isCategoryIcon = (value: string): value is CategoryIcon => categoryIconSet.has(value);

export const getCategoryIconEntry = (key: CategoryIcon) => {
  const selected = catalogByKey.get(key);
  if (selected) {
    return selected;
  }

  const fallback = catalogByKey.get(DEFAULT_CATEGORY_ICON);
  if (fallback) {
    return fallback;
  }

  return CATEGORY_ICON_CATALOG[0];
};

export const parseCategoryIcon = (value: string): CategoryIcon | null =>
  isCategoryIcon(value) ? value : null;
