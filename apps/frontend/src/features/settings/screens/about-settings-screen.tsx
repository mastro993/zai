import { useState } from "react";
import { Result } from "@praha/byethrow";

import { toast } from "@/components/toaster/toast";
import { ScreenBase } from "@/components/screen-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ItemGroup } from "@/components/ui/item";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { AboutSettingsRow } from "../components/about-settings-row";
import {
  ABOUT_APP_IDENTIFIER,
  ABOUT_LICENSE,
  ABOUT_TAURI_VERSION,
  aboutPackageVersion,
  resolveAboutAppVersion,
  resolveAboutBuildMode,
} from "../lib/about-info";
import {
  checkForUpdates,
  isUpdateChannel,
  isUpdaterAvailable,
  isUpdaterTarget,
  readUpdateChannel,
  writeUpdateChannel,
  type UpdateChannel,
  type UpdateProgress,
} from "../lib/updater";

function AboutSettingsDivider() {
  return <div className="mx-4 h-px bg-border" />;
}

const updateChannelItems: Array<{ label: string; value: UpdateChannel }> = [
  { label: "Stable", value: "stable" },
  { label: "Nightly", value: "nightly" },
];

export function AboutSettingsScreen() {
  const packageVersion = aboutPackageVersion();
  const appVersion = resolveAboutAppVersion(packageVersion);
  const buildMode = resolveAboutBuildMode(import.meta.env.PROD);
  const buildTarget = import.meta.env.VITE_ZAI_BUILD_TARGET;
  const updaterTarget = import.meta.env.VITE_ZAI_UPDATER_TARGET;
  const showUpdater = buildTarget === "tauri";
  const updaterAvailable = isUpdaterAvailable(buildTarget, packageVersion, updaterTarget);
  const [channel, setChannel] = useState<UpdateChannel>(readUpdateChannel);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const busy = checking || progress !== null;

  const updateDescription =
    packageVersion === "0.0.0-dev"
      ? "Update checks are disabled in development builds."
      : updaterAvailable
        ? `Checks ${channel} releases when Zai starts.`
        : "Update checks are unavailable in this build.";

  const handleChannelChange = (value: string | null) => {
    if (!isUpdateChannel(value)) {
      return;
    }
    if (!writeUpdateChannel(value)) {
      toast.error("Update channel could not be saved.");
      return;
    }
    setChannel(value);
  };

  const handleUpdateCheck = async () => {
    if (!updaterAvailable || !isUpdaterTarget(updaterTarget)) {
      toast.info(updateDescription);
      return;
    }

    setChecking(true);
    setProgress(null);
    const result = await checkForUpdates(channel, updaterTarget, setProgress);
    setChecking(false);
    setProgress(null);

    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }
    if (result.value === "current") {
      toast.success("Zai is up to date.");
    } else if (result.value === "busy") {
      toast.info("An update check is already running.");
    }
  };

  const buttonLabel =
    progress?.phase === "installing"
      ? "Installing…"
      : progress?.phase === "downloading"
        ? "Downloading…"
        : checking
          ? "Checking…"
          : "Check for updates";

  return (
    <ScreenBase>
      <div className="flex max-w-3xl flex-col gap-6">
        <Card className="gap-0! py-0!">
          <CardContent className="px-0!">
            <ItemGroup className="gap-0">
              <AboutSettingsRow title="App version" value={appVersion} />
              {showUpdater ? (
                <>
                  <AboutSettingsDivider />
                  <AboutSettingsRow title="Update channel">
                    <Select
                      items={updateChannelItems}
                      value={channel}
                      onValueChange={handleChannelChange}
                      disabled={!updaterAvailable || busy}
                    >
                      <SelectTrigger aria-label="Update channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {updateChannelItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </AboutSettingsRow>
                  <AboutSettingsDivider />
                  <AboutSettingsRow title="Check for a new version" description={updateDescription}>
                    <div className="flex min-w-48 flex-col items-end gap-2">
                      <Button
                        type="button"
                        disabled={!updaterAvailable || busy}
                        onClick={() => void handleUpdateCheck()}
                      >
                        {busy ? <Spinner data-icon="inline-start" /> : null}
                        {buttonLabel}
                      </Button>
                      {progress ? (
                        <Progress value={progress.percent ?? null} className="w-48 gap-1">
                          <ProgressLabel>
                            {progress.phase === "installing" ? "Installing" : "Downloading"}
                          </ProgressLabel>
                          <ProgressValue>
                            {() =>
                              progress.percent === undefined ? "Working" : `${progress.percent}%`
                            }
                          </ProgressValue>
                        </Progress>
                      ) : null}
                    </div>
                  </AboutSettingsRow>
                </>
              ) : null}
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
