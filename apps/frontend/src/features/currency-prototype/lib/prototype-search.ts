export const PROTOTYPE_VARIANTS = ["A", "B", "C"] as const;
export const PROTOTYPE_SCENES = ["setup", "settings", "form", "detail", "import"] as const;

export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number];
export type PrototypeScene = (typeof PROTOTYPE_SCENES)[number];

export const VARIANT_NAMES: Record<PrototypeVariant, string> = {
  A: "Ledger",
  B: "Inspector",
  C: "Workspace",
};

export const SCENE_LABELS: Record<PrototypeScene, string> = {
  setup: "Initial setup",
  settings: "Currency settings",
  form: "Transaction form",
  detail: "Transaction detail",
  import: "Import preview",
};

export interface CurrencyPrototypeSearch {
  variant: PrototypeVariant;
  scene: PrototypeScene;
}

const isVariant = (value: unknown): value is PrototypeVariant =>
  value === "A" || value === "B" || value === "C";

const isScene = (value: unknown): value is PrototypeScene =>
  value === "setup" ||
  value === "settings" ||
  value === "form" ||
  value === "detail" ||
  value === "import";

export interface SettingsPrototypeSearch {
  variant?: PrototypeVariant;
  scene?: PrototypeScene;
}

export const parseSettingsPrototypeSearch = (
  search: Record<string, unknown>,
): SettingsPrototypeSearch => {
  if (!isVariant(search.variant)) {
    return {};
  }

  return {
    variant: search.variant,
    scene: isScene(search.scene) ? search.scene : "settings",
  };
};
