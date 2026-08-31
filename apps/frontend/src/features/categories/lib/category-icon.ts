import {
  Airplane01Icon,
  Apple01Icon,
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  Baby01Icon,
  BankIcon,
  Basketball01Icon,
  BeachIcon,
  BicycleIcon,
  BoatIcon,
  BookOpen01Icon,
  BottleWineIcon,
  BrainIcon,
  Bread01Icon,
  Briefcase01Icon,
  Bus01Icon,
  Camera01Icon,
  Car01Icon,
  Cash01Icon,
  CatIcon,
  CctvIcon,
  CharityIcon,
  ChartIncreaseIcon,
  CleanIcon,
  CloudIcon,
  CodeIcon,
  Coffee01Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  DiamondIcon,
  DrinkIcon,
  Dumbbell01Icon,
  Film01Icon,
  FirstAidKitIcon,
  FlashIcon,
  FuelStationIcon,
  GameController01Icon,
  GiftIcon,
  GlassesIcon,
  GuitarIcon,
  HairDryerIcon,
  HealthIcon,
  HeartIcon,
  Home01Icon,
  Hospital01Icon,
  Hotel01Icon,
  House01Icon,
  IceCream01Icon,
  Invoice01Icon,
  JusticeScaleIcon,
  LaptopIcon,
  Luggage01Icon,
  Medicine01Icon,
  Money01Icon,
  MoreHorizontalCircle01Icon,
  Mortarboard01Icon,
  MountainIcon,
  MusicNote01Icon,
  OfficeIcon,
  PackageIcon,
  PaintBoardIcon,
  ParkingAreaSquareIcon,
  PartyIcon,
  PercentIcon,
  PiggyBankIcon,
  Pizza01Icon,
  Plant01Icon,
  PopcornIcon,
  PrinterIcon,
  PuzzleIcon,
  ReceiptDollarIcon,
  RepeatIcon,
  Restaurant01Icon,
  Scooter01Icon,
  ScissorIcon,
  ServingFoodIcon,
  Shield01Icon,
  Shirt01Icon,
  ShoppingBag01Icon,
  ShoppingBasket01Icon,
  SmartPhone01Icon,
  Sofa01Icon,
  StethoscopeIcon,
  Tag01Icon,
  TaxiIcon,
  TentIcon,
  Ticket01Icon,
  ToolsIcon,
  Train01Icon,
  TruckIcon,
  UserGroupIcon,
  UserMultipleIcon,
  WashingMachineIcon,
  Wifi01Icon,
  Wrench01Icon,
  Yoga01Icon,
} from "@hugeicons/core-free-icons";
import type { ComponentProps } from "react";
import type { HugeiconsIcon } from "@hugeicons/react";

type HugeIcon = ComponentProps<typeof HugeiconsIcon>["icon"];

export const CATEGORY_ICON_GROUPS = [
  "Food",
  "Lifestyle",
  "Home",
  "Health",
  "Travel",
  "Leisure",
  "Finance",
  "General",
] as const;

export type CategoryIconGroup = (typeof CATEGORY_ICON_GROUPS)[number];

export const CATEGORY_ICON_CATALOG = [
  { key: "food", label: "Food", group: "Food", icon: ServingFoodIcon },
  { key: "groceries", label: "Groceries", group: "Food", icon: ShoppingBasket01Icon },
  { key: "dining", label: "Dining", group: "Food", icon: Restaurant01Icon },
  { key: "coffee", label: "Coffee", group: "Food", icon: Coffee01Icon },
  { key: "drinks", label: "Drinks", group: "Food", icon: DrinkIcon },
  { key: "bakery", label: "Bakery", group: "Food", icon: Bread01Icon },
  { key: "delivery", label: "Delivery", group: "Food", icon: DeliveryTruck01Icon },
  { key: "pizza", label: "Pizza", group: "Food", icon: Pizza01Icon },
  { key: "snacks", label: "Snacks", group: "Food", icon: PopcornIcon },
  { key: "alcohol", label: "Alcohol", group: "Food", icon: BottleWineIcon },
  { key: "icecream", label: "Ice cream", group: "Food", icon: IceCream01Icon },
  { key: "fruit", label: "Fruit", group: "Food", icon: Apple01Icon },
  { key: "phone", label: "Phone", group: "Lifestyle", icon: SmartPhone01Icon },
  { key: "internet", label: "Internet", group: "Lifestyle", icon: Wifi01Icon },
  { key: "shopping", label: "Shopping", group: "Lifestyle", icon: ShoppingBag01Icon },
  { key: "clothing", label: "Clothing", group: "Lifestyle", icon: Shirt01Icon },
  { key: "education", label: "Education", group: "Lifestyle", icon: Mortarboard01Icon },
  { key: "books", label: "Books", group: "Lifestyle", icon: BookOpen01Icon },
  { key: "subscriptions", label: "Subscriptions", group: "Lifestyle", icon: RepeatIcon },
  { key: "electronics", label: "Electronics", group: "Lifestyle", icon: LaptopIcon },
  { key: "software", label: "Software", group: "Lifestyle", icon: CodeIcon },
  { key: "jewelry", label: "Jewelry", group: "Lifestyle", icon: DiamondIcon },
  { key: "cloud", label: "Cloud", group: "Lifestyle", icon: CloudIcon },
  { key: "print", label: "Print", group: "Lifestyle", icon: PrinterIcon },
  { key: "home", label: "Home", group: "Home", icon: Home01Icon },
  { key: "rent", label: "Rent", group: "Home", icon: House01Icon },
  { key: "utilities", label: "Utilities", group: "Home", icon: FlashIcon },
  { key: "laundry", label: "Laundry", group: "Home", icon: WashingMachineIcon },
  { key: "furniture", label: "Furniture", group: "Home", icon: Sofa01Icon },
  { key: "repairs", label: "Repairs", group: "Home", icon: Wrench01Icon },
  { key: "garden", label: "Garden", group: "Home", icon: Plant01Icon },
  { key: "cleaning", label: "Cleaning", group: "Home", icon: CleanIcon },
  { key: "packages", label: "Packages", group: "Home", icon: PackageIcon },
  { key: "tools", label: "Tools", group: "Home", icon: ToolsIcon },
  { key: "security", label: "Security", group: "Home", icon: CctvIcon },
  { key: "supplies", label: "Supplies", group: "Home", icon: Archive01Icon },
  { key: "health", label: "Health", group: "Health", icon: HealthIcon },
  { key: "pharmacy", label: "Pharmacy", group: "Health", icon: Medicine01Icon },
  { key: "fitness", label: "Fitness", group: "Health", icon: Dumbbell01Icon },
  { key: "beauty", label: "Beauty", group: "Health", icon: HairDryerIcon },
  { key: "hospital", label: "Hospital", group: "Health", icon: Hospital01Icon },
  { key: "vision", label: "Vision", group: "Health", icon: GlassesIcon },
  { key: "haircut", label: "Haircut", group: "Health", icon: ScissorIcon },
  { key: "doctor", label: "Doctor", group: "Health", icon: StethoscopeIcon },
  { key: "firstaid", label: "First aid", group: "Health", icon: FirstAidKitIcon },
  { key: "therapy", label: "Therapy", group: "Health", icon: BrainIcon },
  { key: "yoga", label: "Yoga", group: "Health", icon: Yoga01Icon },
  { key: "wellness", label: "Wellness", group: "Health", icon: HeartIcon },
  { key: "transport", label: "Transport", group: "Travel", icon: Bus01Icon },
  { key: "car", label: "Car", group: "Travel", icon: Car01Icon },
  { key: "fuel", label: "Fuel", group: "Travel", icon: FuelStationIcon },
  { key: "parking", label: "Parking", group: "Travel", icon: ParkingAreaSquareIcon },
  { key: "bicycle", label: "Bicycle", group: "Travel", icon: BicycleIcon },
  { key: "train", label: "Train", group: "Travel", icon: Train01Icon },
  { key: "flight", label: "Flight", group: "Travel", icon: Airplane01Icon },
  { key: "hotel", label: "Hotel", group: "Travel", icon: Hotel01Icon },
  { key: "travel", label: "Travel", group: "Travel", icon: Luggage01Icon },
  { key: "taxi", label: "Taxi", group: "Travel", icon: TaxiIcon },
  { key: "boat", label: "Boat", group: "Travel", icon: BoatIcon },
  { key: "scooter", label: "Scooter", group: "Travel", icon: Scooter01Icon },
  { key: "entertainment", label: "Entertainment", group: "Leisure", icon: Ticket01Icon },
  { key: "gaming", label: "Gaming", group: "Leisure", icon: GameController01Icon },
  { key: "music", label: "Music", group: "Leisure", icon: MusicNote01Icon },
  { key: "movies", label: "Movies", group: "Leisure", icon: Film01Icon },
  { key: "sports", label: "Sports", group: "Leisure", icon: Basketball01Icon },
  { key: "hobbies", label: "Hobbies", group: "Leisure", icon: PaintBoardIcon },
  { key: "outdoors", label: "Outdoors", group: "Leisure", icon: MountainIcon },
  { key: "beach", label: "Beach", group: "Leisure", icon: BeachIcon },
  { key: "party", label: "Party", group: "Leisure", icon: PartyIcon },
  { key: "photos", label: "Photos", group: "Leisure", icon: Camera01Icon },
  { key: "camping", label: "Camping", group: "Leisure", icon: TentIcon },
  { key: "concert", label: "Concert", group: "Leisure", icon: GuitarIcon },
  { key: "taxes", label: "Taxes", group: "Finance", icon: Invoice01Icon },
  { key: "insurance", label: "Insurance", group: "Finance", icon: Shield01Icon },
  { key: "savings", label: "Savings", group: "Finance", icon: PiggyBankIcon },
  { key: "investments", label: "Investments", group: "Finance", icon: ChartIncreaseIcon },
  { key: "salary", label: "Salary", group: "Finance", icon: Money01Icon },
  { key: "business", label: "Business", group: "Finance", icon: Briefcase01Icon },
  { key: "transfer", label: "Transfer", group: "Finance", icon: ArrowDataTransferHorizontalIcon },
  { key: "cash", label: "Cash", group: "Finance", icon: Cash01Icon },
  { key: "credit", label: "Credit", group: "Finance", icon: CreditCardIcon },
  { key: "bills", label: "Bills", group: "Finance", icon: ReceiptDollarIcon },
  { key: "bank", label: "Bank", group: "Finance", icon: BankIcon },
  { key: "fees", label: "Fees", group: "Finance", icon: PercentIcon },
  { key: "default", label: "Default", group: "General", icon: Tag01Icon },
  { key: "other", label: "Other", group: "General", icon: MoreHorizontalCircle01Icon },
  { key: "gifts", label: "Gifts", group: "General", icon: GiftIcon },
  { key: "charity", label: "Charity", group: "General", icon: CharityIcon },
  { key: "family", label: "Family", group: "General", icon: UserGroupIcon },
  { key: "childcare", label: "Childcare", group: "General", icon: Baby01Icon },
  { key: "pets", label: "Pets", group: "General", icon: CatIcon },
  { key: "work", label: "Work", group: "General", icon: OfficeIcon },
  { key: "friends", label: "Friends", group: "General", icon: UserMultipleIcon },
  { key: "kids", label: "Kids", group: "General", icon: PuzzleIcon },
  { key: "legal", label: "Legal", group: "General", icon: JusticeScaleIcon },
  { key: "shipping", label: "Shipping", group: "General", icon: TruckIcon },
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
