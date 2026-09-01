import {
  Airplane01Icon,
  AmbulanceIcon,
  Apple01Icon,
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  Baby01Icon,
  BankIcon,
  Basketball01Icon,
  BeachIcon,
  BedIcon,
  BellIcon,
  BicepsFlexedIcon,
  BicycleIcon,
  BirdIcon,
  BirdhouseIcon,
  BitcoinIcon,
  BoatIcon,
  Bone01Icon,
  BookOpen01Icon,
  BottleWineIcon,
  BowlingIcon,
  BrainIcon,
  Bread01Icon,
  Briefcase01Icon,
  BriefcaseMedicalIcon,
  Bug01Icon,
  Bus01Icon,
  Calendar01Icon,
  Camera01Icon,
  CampfireIcon,
  Car01Icon,
  Cash01Icon,
  CatIcon,
  CctvIcon,
  CharityIcon,
  ChartIncreaseIcon,
  ChurchIcon,
  CleanIcon,
  Clock01Icon,
  CloudIcon,
  CloudRainIcon,
  CloudyIcon,
  CodeIcon,
  Coffee01Icon,
  CompassIcon,
  CreditCardIcon,
  DatabaseIcon,
  DeliveryTruck01Icon,
  DentalToothIcon,
  DeskIcon,
  DiamondIcon,
  DiceIcon,
  DrinkIcon,
  DropletIcon,
  Dumbbell01Icon,
  EquipmentGym03Icon,
  Film01Icon,
  Fire02Icon,
  FirstAidKitIcon,
  FishFoodIcon,
  FishIcon,
  FishingHookIcon,
  FishingRodIcon,
  FlashIcon,
  FlowerIcon,
  FootballIcon,
  FridgeIcon,
  FrisbeeIcon,
  FuelStationIcon,
  GameController01Icon,
  GiftIcon,
  GlassWaterIcon,
  GlassesIcon,
  GlobeIcon,
  GolfHoleIcon,
  GuitarIcon,
  HairDryerIcon,
  Hamburger02Icon,
  HandshakeIcon,
  HeadphonesIcon,
  HealthIcon,
  HeartIcon,
  Home01Icon,
  HorseHeadIcon,
  HorseIcon,
  HorseSaddleIcon,
  Hospital01Icon,
  Hotel01Icon,
  House01Icon,
  IceCream01Icon,
  IdCardLanyardIcon,
  IdentityCardIcon,
  InjectionIcon,
  Invoice01Icon,
  JusticeScaleIcon,
  KeyboardIcon,
  Key01Icon,
  LaptopIcon,
  Leaf01Icon,
  LibraryIcon,
  Luggage01Icon,
  Medicine01Icon,
  MedicineBottle01Icon,
  MeetingRoomIcon,
  Megaphone01Icon,
  MetroIcon,
  Money01Icon,
  Moon01Icon,
  MoreHorizontalCircle01Icon,
  Mortarboard01Icon,
  Motorbike01Icon,
  MountainIcon,
  Mouse01Icon,
  MusicNote01Icon,
  News01Icon,
  OfficeIcon,
  PackageIcon,
  PaintBoardIcon,
  ParkingAreaSquareIcon,
  PartyIcon,
  PassportIcon,
  PercentIcon,
  PiggyBankIcon,
  PillsTabletIcon,
  Pizza01Icon,
  Plant01Icon,
  PopcornIcon,
  PrescriptionIcon,
  Presentation01Icon,
  PrinterIcon,
  PuzzleIcon,
  Radio01Icon,
  RainbowIcon,
  ReceiptDollarIcon,
  Recycle01Icon,
  RepeatIcon,
  Restaurant01Icon,
  RockingHorseIcon,
  Router01Icon,
  RubberDuckIcon,
  SafeIcon,
  SaladIcon,
  SchoolIcon,
  Scooter01Icon,
  ScissorIcon,
  ServerStack01Icon,
  ServingFoodIcon,
  ShellfishIcon,
  Shield01Icon,
  Shirt01Icon,
  ShoppingBag01Icon,
  ShoppingBasket01Icon,
  ShowerHeadIcon,
  SmartPhone01Icon,
  SmartWatch01Icon,
  SnowIcon,
  Sofa01Icon,
  StethoscopeIcon,
  Sun03Icon,
  Sushi01Icon,
  SwimmingIcon,
  Tag01Icon,
  TaxiIcon,
  TeacherIcon,
  TeaIcon,
  TentIcon,
  Ticket01Icon,
  ToolsIcon,
  Train01Icon,
  Tree01Icon,
  TreePalmIcon,
  TruckIcon,
  Tv01Icon,
  UmbrellaIcon,
  UniversityIcon,
  UserGroupIcon,
  UserMultipleIcon,
  Wallet01Icon,
  WashingMachineIcon,
  WaveIcon,
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
  "Pets",
  "Work",
  "Nature",
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
  { key: "hamburger", label: "Hamburger", group: "Food", icon: Hamburger02Icon },
  { key: "sushi", label: "Sushi", group: "Food", icon: Sushi01Icon },
  { key: "salad", label: "Salad", group: "Food", icon: SaladIcon },
  { key: "tea", label: "Tea", group: "Food", icon: TeaIcon },
  { key: "beer", label: "Beer", group: "Food", icon: GlassWaterIcon },
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
  { key: "headphones", label: "Headphones", group: "Lifestyle", icon: HeadphonesIcon },
  { key: "tv", label: "TV", group: "Lifestyle", icon: Tv01Icon },
  { key: "news", label: "News", group: "Lifestyle", icon: News01Icon },
  { key: "watch", label: "Watch", group: "Lifestyle", icon: SmartWatch01Icon },
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
  { key: "bed", label: "Bed", group: "Home", icon: BedIcon },
  { key: "fridge", label: "Fridge", group: "Home", icon: FridgeIcon },
  { key: "shower", label: "Shower", group: "Home", icon: ShowerHeadIcon },
  { key: "recycle", label: "Recycle", group: "Home", icon: Recycle01Icon },
  { key: "health", label: "Health", group: "Health", icon: HealthIcon },
  { key: "pharmacy", label: "Pharmacy", group: "Health", icon: Medicine01Icon },
  { key: "fitness", label: "Fitness", group: "Health", icon: Dumbbell01Icon },
  { key: "gym", label: "Gym", group: "Health", icon: EquipmentGym03Icon },
  { key: "muscle", label: "Muscle", group: "Health", icon: BicepsFlexedIcon },
  { key: "beauty", label: "Beauty", group: "Health", icon: HairDryerIcon },
  { key: "hospital", label: "Hospital", group: "Health", icon: Hospital01Icon },
  { key: "vision", label: "Vision", group: "Health", icon: GlassesIcon },
  { key: "haircut", label: "Haircut", group: "Health", icon: ScissorIcon },
  { key: "doctor", label: "Doctor", group: "Health", icon: StethoscopeIcon },
  { key: "firstaid", label: "First aid", group: "Health", icon: FirstAidKitIcon },
  { key: "therapy", label: "Therapy", group: "Health", icon: BrainIcon },
  { key: "yoga", label: "Yoga", group: "Health", icon: Yoga01Icon },
  { key: "wellness", label: "Wellness", group: "Health", icon: HeartIcon },
  { key: "dental", label: "Dental", group: "Health", icon: DentalToothIcon },
  { key: "ambulance", label: "Ambulance", group: "Health", icon: AmbulanceIcon },
  { key: "pills", label: "Pills", group: "Health", icon: PillsTabletIcon },
  { key: "supplements", label: "Supplements", group: "Health", icon: MedicineBottle01Icon },
  { key: "medicines", label: "Medicines", group: "Health", icon: PrescriptionIcon },
  { key: "doctors", label: "Doctors", group: "Health", icon: BriefcaseMedicalIcon },
  { key: "swimming", label: "Swimming", group: "Health", icon: SwimmingIcon },
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
  { key: "motorcycle", label: "Motorcycle", group: "Travel", icon: Motorbike01Icon },
  { key: "metro", label: "Metro", group: "Travel", icon: MetroIcon },
  { key: "passport", label: "Passport", group: "Travel", icon: PassportIcon },
  { key: "compass", label: "Compass", group: "Travel", icon: CompassIcon },
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
  { key: "bowling", label: "Bowling", group: "Leisure", icon: BowlingIcon },
  { key: "golf", label: "Golf", group: "Leisure", icon: GolfHoleIcon },
  { key: "soccer", label: "Soccer", group: "Leisure", icon: FootballIcon },
  { key: "radio", label: "Radio", group: "Leisure", icon: Radio01Icon },
  { key: "dice", label: "Dice", group: "Leisure", icon: DiceIcon },
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
  { key: "wallet", label: "Wallet", group: "Finance", icon: Wallet01Icon },
  { key: "bitcoin", label: "Bitcoin", group: "Finance", icon: BitcoinIcon },
  { key: "safe", label: "Safe", group: "Finance", icon: SafeIcon },
  { key: "handshake", label: "Handshake", group: "Finance", icon: HandshakeIcon },
  { key: "fish", label: "Fish", group: "Pets", icon: FishIcon },
  { key: "bird", label: "Bird", group: "Pets", icon: BirdIcon },
  { key: "horse", label: "Horse", group: "Pets", icon: HorseIcon },
  { key: "bone", label: "Bone", group: "Pets", icon: Bone01Icon },
  { key: "fishfood", label: "Fish food", group: "Pets", icon: FishFoodIcon },
  { key: "fishing", label: "Fishing", group: "Pets", icon: FishingRodIcon },
  { key: "birdhouse", label: "Birdhouse", group: "Pets", icon: BirdhouseIcon },
  { key: "rubberduck", label: "Rubber duck", group: "Pets", icon: RubberDuckIcon },
  { key: "frisbee", label: "Frisbee", group: "Pets", icon: FrisbeeIcon },
  { key: "rockinghorse", label: "Rocking horse", group: "Pets", icon: RockingHorseIcon },
  { key: "bug", label: "Bug", group: "Pets", icon: Bug01Icon },
  { key: "shellfish", label: "Shellfish", group: "Pets", icon: ShellfishIcon },
  { key: "horsehead", label: "Horse head", group: "Pets", icon: HorseHeadIcon },
  { key: "saddle", label: "Saddle", group: "Pets", icon: HorseSaddleIcon },
  { key: "fishinghook", label: "Fishing hook", group: "Pets", icon: FishingHookIcon },
  { key: "injection", label: "Injection", group: "Pets", icon: InjectionIcon },
  { key: "calendar", label: "Calendar", group: "Work", icon: Calendar01Icon },
  { key: "presentation", label: "Presentation", group: "Work", icon: Presentation01Icon },
  { key: "meeting", label: "Meeting", group: "Work", icon: MeetingRoomIcon },
  { key: "identity", label: "Identity", group: "Work", icon: IdentityCardIcon },
  { key: "desk", label: "Desk", group: "Work", icon: DeskIcon },
  { key: "megaphone", label: "Megaphone", group: "Work", icon: Megaphone01Icon },
  { key: "server", label: "Server", group: "Work", icon: ServerStack01Icon },
  { key: "database", label: "Database", group: "Work", icon: DatabaseIcon },
  { key: "keyboard", label: "Keyboard", group: "Work", icon: KeyboardIcon },
  { key: "mouse", label: "Mouse", group: "Work", icon: Mouse01Icon },
  { key: "router", label: "Router", group: "Work", icon: Router01Icon },
  { key: "school", label: "School", group: "Work", icon: SchoolIcon },
  { key: "university", label: "University", group: "Work", icon: UniversityIcon },
  { key: "library", label: "Library", group: "Work", icon: LibraryIcon },
  { key: "teacher", label: "Teacher", group: "Work", icon: TeacherIcon },
  { key: "lanyard", label: "Lanyard", group: "Work", icon: IdCardLanyardIcon },
  { key: "sun", label: "Sun", group: "Nature", icon: Sun03Icon },
  { key: "moon", label: "Moon", group: "Nature", icon: Moon01Icon },
  { key: "rain", label: "Rain", group: "Nature", icon: CloudRainIcon },
  { key: "snow", label: "Snow", group: "Nature", icon: SnowIcon },
  { key: "umbrella", label: "Umbrella", group: "Nature", icon: UmbrellaIcon },
  { key: "tree", label: "Tree", group: "Nature", icon: Tree01Icon },
  { key: "leaf", label: "Leaf", group: "Nature", icon: Leaf01Icon },
  { key: "flower", label: "Flower", group: "Nature", icon: FlowerIcon },
  { key: "globe", label: "Globe", group: "Nature", icon: GlobeIcon },
  { key: "fire", label: "Fire", group: "Nature", icon: Fire02Icon },
  { key: "water", label: "Water", group: "Nature", icon: DropletIcon },
  { key: "cloudy", label: "Cloudy", group: "Nature", icon: CloudyIcon },
  { key: "rainbow", label: "Rainbow", group: "Nature", icon: RainbowIcon },
  { key: "palm", label: "Palm", group: "Nature", icon: TreePalmIcon },
  { key: "wave", label: "Wave", group: "Nature", icon: WaveIcon },
  { key: "campfire", label: "Campfire", group: "Nature", icon: CampfireIcon },
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
  { key: "church", label: "Church", group: "General", icon: ChurchIcon },
  { key: "keys", label: "Keys", group: "General", icon: Key01Icon },
  { key: "bell", label: "Bell", group: "General", icon: BellIcon },
  { key: "alarm", label: "Alarm", group: "General", icon: Clock01Icon },
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

export const categoryIconMatchesQuery = (
  entry: (typeof CATEGORY_ICON_CATALOG)[number],
  query: string,
): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }

  return (
    entry.label.toLowerCase().includes(needle) ||
    entry.key.includes(needle) ||
    entry.group.toLowerCase().includes(needle)
  );
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const iconWordPattern = (word: string) =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`);

const tokenizeIconText = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

export const suggestCategoryIcons = (name: string, description: string) => {
  const haystack = `${name} ${description}`.trim().toLowerCase();
  if (haystack.length === 0) {
    return [];
  }

  const tokens = new Set(tokenizeIconText(haystack));
  const ranked = CATEGORY_ICON_CATALOG.flatMap((entry) => {
    const label = entry.label.toLowerCase();
    const labelWords = tokenizeIconText(label);
    let score = 0;
    if (iconWordPattern(label).test(haystack) || iconWordPattern(entry.key).test(haystack)) {
      score += 3;
    }
    if (labelWords.length > 1 && labelWords.every((word) => tokens.has(word))) {
      score += 2;
    } else if (labelWords.some((word) => word.length >= 3 && tokens.has(word))) {
      score += 1;
    }
    return score > 0 ? [{ entry, score }] : [];
  });

  ranked.sort((left, right) => right.score - left.score);
  return ranked.slice(0, 8).map((item) => item.entry);
};
