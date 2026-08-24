import { toast } from "@/components/toaster/toast";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";

import { AboutSettingsRow } from "../components/about-settings-row";
import { SettingsSectionHeader } from "../components/settings-section-header";
import {
  ABOUT_APP_IDENTIFIER,
  ABOUT_APP_NAME,
  ABOUT_APP_VERSION,
  ABOUT_LICENSE,
  ABOUT_RELEASE_CHANNEL,
  ABOUT_TAURI_VERSION,
  UPDATE_CHECK_UNAVAILABLE_MESSAGE,
  resolveAboutBuildMode,
} from "../lib/about-info";

export function AboutSettingsScreen() {
  const buildMode = resolveAboutBuildMode(import.meta.env.PROD);

  return (
    <ScreenBase>
      <FieldGroup className="max-w-3xl gap-10">
        <SettingsSectionHeader title="About" />
        <FieldGroup className="gap-0">
          <AboutSettingsRow
            title="App version"
            description={`Keep ${ABOUT_APP_NAME} up to date with the latest features and fixes.`}
            value={`Version ${ABOUT_APP_VERSION}`}
          />
          <FieldSeparator />
          <AboutSettingsRow
            title="Release channel"
            description="Alpha is the current channel. Main and Beta will appear when updates ship."
            value={ABOUT_RELEASE_CHANNEL}
          />
          <FieldSeparator />
          <AboutSettingsRow
            title="Check for a new version"
            description={UPDATE_CHECK_UNAVAILABLE_MESSAGE}
          >
            <Button
              type="button"
              onClick={() => {
                toast.info(UPDATE_CHECK_UNAVAILABLE_MESSAGE);
              }}
            >
              Check for updates
            </Button>
          </AboutSettingsRow>
        </FieldGroup>
        <FieldGroup className="gap-0">
          <AboutSettingsRow title="Build mode" value={buildMode} />
          <FieldSeparator />
          <AboutSettingsRow title="Tauri version" value={ABOUT_TAURI_VERSION} />
          <FieldSeparator />
          <AboutSettingsRow title="App identifier" value={ABOUT_APP_IDENTIFIER} />
          <FieldSeparator />
          <AboutSettingsRow title="License" value={ABOUT_LICENSE} />
        </FieldGroup>
      </FieldGroup>
    </ScreenBase>
  );
}
