import type { CSSProperties } from "react";
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

const FLUSH_CARD_STYLE = { "--card-spacing": "0px" } as CSSProperties;

function AboutSettingsDivider() {
  return <ItemSeparator className="mx-4 my-0 data-horizontal:w-[calc(100%-2rem)]" />;
}

export function AboutSettingsScreen() {
  const buildMode = resolveAboutBuildMode(import.meta.env.PROD);

  return (
    <ScreenBase>
      <div className="flex max-w-3xl flex-col gap-6">
        <SettingsSectionHeader title="About" />
        <Card style={FLUSH_CARD_STYLE}>
          <CardContent>
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="App version" value={`Version ${ABOUT_APP_VERSION}`} />
              <AboutSettingsDivider />
              <AboutSettingsRow
                title="Release channel"
                description="Alpha is the current channel. Main and Beta will appear when updates ship."
                value={ABOUT_RELEASE_CHANNEL}
              />
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
        <Card style={FLUSH_CARD_STYLE}>
          <CardContent>
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
