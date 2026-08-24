import { toast } from "@/components/toaster/toast";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemGroup, ItemSeparator } from "@/components/ui/item";

import { AboutSettingsRow } from "../components/about-settings-row";
import { SettingsSectionHeader } from "../components/settings-section-header";
import {
  ABOUT_APP_IDENTIFIER,
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
      <div className="flex max-w-3xl flex-col gap-6">
        <SettingsSectionHeader title="About" />
        <Card>
          <CardContent>
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="App version" value={`Version ${ABOUT_APP_VERSION}`} />
              <ItemSeparator />
              <AboutSettingsRow
                title="Release channel"
                description="Alpha is the current channel. Main and Beta will appear when updates ship."
                value={ABOUT_RELEASE_CHANNEL}
              />
              <ItemSeparator />
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
            </ItemGroup>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="Build mode" value={buildMode} />
              <ItemSeparator />
              <AboutSettingsRow title="Tauri version" value={ABOUT_TAURI_VERSION} />
              <ItemSeparator />
              <AboutSettingsRow title="App identifier" value={ABOUT_APP_IDENTIFIER} />
              <ItemSeparator />
              <AboutSettingsRow title="License" value={ABOUT_LICENSE} />
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </ScreenBase>
  );
}
