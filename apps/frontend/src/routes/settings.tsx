import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "next-themes";

import { ScreenBase } from "@/components/screen-base";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CurrencySettingsScreen } from "@/features/currency/screens/currency-settings-screen";
import { CurrencyControlsPrototypeScreen } from "@/features/currency-prototype/screens/currency-controls-prototype-screen";
import { parseSettingsPrototypeSearch } from "@/features/currency-prototype/lib/prototype-search";

// Three variants of currency settings and transaction currency controls,
// switchable via ?variant=, on the existing /settings route.
export const Route = createFileRoute("/settings")({
  validateSearch: parseSettingsPrototypeSearch,
  component: SettingsPage,
});

const THEME_MODES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

type ThemeMode = (typeof THEME_MODES)[number]["value"];

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} satisfies Record<ThemeMode, string>;

const isThemeMode = (value: string | undefined): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

function SettingsPage() {
  const search = Route.useSearch();
  if (search.variant) {
    return (
      <CurrencyControlsPrototypeScreen
        search={{ variant: search.variant, scene: search.scene ?? "settings" }}
      />
    );
  }

  return (
    <ScreenBase>
      <FieldGroup className="max-w-3xl gap-3">
        <ThemeModeSetting />
        <Field className="border border-border p-4">
          <FieldContent>
            <FieldTitle>Currencies</FieldTitle>
            <FieldDescription>
              Default radio, coverage, and refresh live in this table. Add above. Disable,
              re-enable, and set-as-default stay in the row menu.
            </FieldDescription>
          </FieldContent>
          <CurrencySettingsScreen focusRates={search.focus === "rates"} />
        </Field>
      </FieldGroup>
    </ScreenBase>
  );
}

function ThemeModeSetting() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme = isThemeMode(theme) ? theme : "system";
  const activeTheme = mounted ? selectedTheme : "system";
  const resolvedThemeLabel = resolvedTheme === "dark" ? "dark" : "light";
  const description =
    activeTheme === "system"
      ? `System mode is currently ${resolvedThemeLabel}.`
      : `${THEME_LABELS[activeTheme]} mode is pinned for this device.`;

  return (
    <Field
      orientation="responsive"
      className="items-start border border-border p-4 @md/field-group:items-center"
    >
      <FieldContent>
        <FieldTitle id="appearance-title">Appearance</FieldTitle>
        <FieldDescription id="appearance-description">{description}</FieldDescription>
      </FieldContent>
      <ToggleGroup
        aria-describedby="appearance-description"
        aria-labelledby="appearance-title"
        className="w-full @md/field-group:w-fit"
        disabled={!mounted}
        spacing={0}
        value={[activeTheme]}
        variant="outline"
        onValueChange={(values) => {
          const nextTheme = values.at(-1);

          if (isThemeMode(nextTheme)) {
            setTheme(nextTheme);
          }
        }}
      >
        {THEME_MODES.map((mode) => (
          <ToggleGroupItem
            key={mode.value}
            value={mode.value}
            className="min-w-20 flex-1 @md/field-group:flex-none"
          >
            {mode.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}
