import { asWireObject } from "@/lib/wire";

export const PROTOTYPE_VARIANTS = ["A", "B", "C"] as const;
export const PROTOTYPE_SCENES = ["setup", "settings", "form", "detail", "import"] as const;

export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number];
export type PrototypeScene = (typeof PROTOTYPE_SCENES)[number];

export const VARIANT_NAMES = {
  A: "Ledger",
  B: "Inspector",
  C: "Workspace",
} satisfies Record<PrototypeVariant, string>;

export const SCENE_LABELS = {
  setup: "Initial setup",
  settings: "Currency settings",
  form: "Transaction form",
  detail: "Transaction detail",
  import: "Import preview",
} satisfies Record<PrototypeScene, string>;

export interface CurrencyPrototypeSearch {
  variant: PrototypeVariant;
  scene: PrototypeScene;
}

export const parsePrototypeVariant = <TRaw>(value: TRaw): PrototypeVariant | null => {
  if (value === "A") {
    return "A";
  }
  if (value === "B") {
    return "B";
  }
  if (value === "C") {
    return "C";
  }
  return null;
};

export const parsePrototypeScene = <TRaw>(value: TRaw): PrototypeScene | null => {
  if (value === "setup") {
    return "setup";
  }
  if (value === "settings") {
    return "settings";
  }
  if (value === "form") {
    return "form";
  }
  if (value === "detail") {
    return "detail";
  }
  if (value === "import") {
    return "import";
  }
  return null;
};

export interface SettingsPrototypeSearch {
  variant?: PrototypeVariant;
  scene?: PrototypeScene;
  focus?: "rates";
}

export const parseSettingsPrototypeSearch = <TRaw>(search: TRaw): SettingsPrototypeSearch => {
  const record = asWireObject(search);
  if (!record) {
    return {};
  }

  const variant = parsePrototypeVariant(record.variant);
  const focus = record.focus === "rates" ? "rates" : undefined;
  if (!variant) {
    return { focus };
  }

  return {
    variant,
    scene: parsePrototypeScene(record.scene) ?? "settings",
    focus,
  };
};
