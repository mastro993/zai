import { ScreenBase } from "@/components/screen-base";
import { FieldGroup } from "@/components/ui/field";
import { CurrencySettingsScreen } from "@/features/currency/screens/currency-settings-screen";

import { SettingsSection, SettingsSectionHeader } from "../components/settings-section";

interface CurrenciesSettingsScreenProps {
  focusRates?: boolean;
  focusAdd?: boolean;
}

export function CurrenciesSettingsScreen({
  focusRates = false,
  focusAdd = false,
}: CurrenciesSettingsScreenProps) {
  return (
    <ScreenBase contentClassName="pt-4">
      <FieldGroup className="max-w-3xl gap-8">
        <SettingsSectionHeader title="Currencies" />
        <SettingsSection title="Enabled currencies">
          <div className="p-4">
            <CurrencySettingsScreen focusRates={focusRates} focusAdd={focusAdd} />
          </div>
        </SettingsSection>
      </FieldGroup>
    </ScreenBase>
  );
}
