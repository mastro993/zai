import { ScreenBase } from "@/components/screen-base";
import { FieldGroup } from "@/components/ui/field";
import { CurrencySettingsScreen } from "@/features/currency/screens/currency-settings-screen";

import { SettingsSectionHeader } from "../components/settings-section-header";

interface CurrenciesSettingsScreenProps {
  focusRates?: boolean;
  focusAdd?: boolean;
}

export function CurrenciesSettingsScreen({
  focusRates = false,
  focusAdd = false,
}: CurrenciesSettingsScreenProps) {
  return (
    <ScreenBase>
      <FieldGroup className="max-w-3xl gap-6">
        <SettingsSectionHeader
          title="Currencies"
          description="Enabled currencies, coverage, and refresh. The default is used for converted amounts."
        />
        <CurrencySettingsScreen focusRates={focusRates} focusAdd={focusAdd} />
      </FieldGroup>
    </ScreenBase>
  );
}
