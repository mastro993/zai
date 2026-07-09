import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "next-themes";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

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
  return (
    <section className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-medium">Settings</h1>
      <FieldGroup className="max-w-3xl gap-3">
        <ThemeModeSetting />
      </FieldGroup>
    </section>
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
