import { toast } from "@/components/toaster/toast";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemGroup } from "@/components/ui/item";

import { AboutSettingsRow } from "../components/about-settings-row";
import { SettingsSectionHeader } from "../components/settings-section-header";
import {
  ABOUT_APP_IDENTIFIER,
  ABOUT_LICENSE,
  ABOUT_TAURI_VERSION,
  UPDATE_CHECK_UNAVAILABLE_MESSAGE,
  aboutPackageVersion,
  resolveAboutAppVersion,
  resolveAboutBuildMode,
  resolveAboutReleaseChannel,
} from "../lib/about-info";

function AboutSettingsDivider() {
  return <div className="mx-4 h-px bg-border" />;
}

export function AboutSettingsScreen() {
  const packageVersion = aboutPackageVersion();
  const appVersion = resolveAboutAppVersion(packageVersion);
  const releaseChannel = resolveAboutReleaseChannel(packageVersion);
  const buildMode = resolveAboutBuildMode(import.meta.env.PROD);

  return (
    <ScreenBase>
      <div className="flex max-w-3xl flex-col gap-6">
        <SettingsSectionHeader title="About" />
        <Card className="gap-0! py-0!">
          <CardContent className="px-0!">
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="App version" value={`Version ${appVersion}`} />
              {releaseChannel ? (
                <>
                  <AboutSettingsDivider />
                  <AboutSettingsRow title="Release channel" value={releaseChannel} />
                </>
              ) : null}
              <AboutSettingsDivider />
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
        <Card className="gap-0! py-0!">
          <CardContent className="px-0!">
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="Build mode" value={buildMode} />
              <AboutSettingsDivider />
              <AboutSettingsRow title="Tauri version" value={ABOUT_TAURI_VERSION} />
              <AboutSettingsDivider />
              <AboutSettingsRow title="App identifier" value={ABOUT_APP_IDENTIFIER} />
              <AboutSettingsDivider />
              <AboutSettingsRow title="License" value={ABOUT_LICENSE} />
            </ItemGroup>
          </CardContent>
        </Card>
      </div>
    </ScreenBase>
  );
}
