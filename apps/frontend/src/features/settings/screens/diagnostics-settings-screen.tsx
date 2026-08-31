import { useCallback, useEffect, useState } from "react";
import { Result } from "@praha/byethrow";
import { Copy01Icon, FolderOpenIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { CommandResult } from "@/commands/shared";
import { ScreenBase } from "@/components/screen-base";
import { toast } from "@/components/toaster/toast";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

import { AboutSettingsRow } from "../components/about-settings-row";
import {
  SettingsSection,
  SettingsSectionDivider,
  SettingsSectionHeader,
} from "../components/settings-section";
import { getDiagnostics, showDatabaseInFolder, showLogsInFolder } from "../commands/diagnostics";
import { aboutPackageVersion, resolveAboutAppVersion } from "../lib/about-info";
import { buildDiagnosticsSummary, formatByteSize, formatOperatingSystem } from "../lib/diagnostics";
import type { Diagnostics } from "../types/diagnostics";

interface DiagnosticValueProps {
  loading?: boolean;
  value?: string | null;
}

function DiagnosticValue({ loading = false, value }: DiagnosticValueProps) {
  if (loading) {
    return <Skeleton className="h-4 w-24" />;
  }

  return (
    <span className="max-w-80 break-all text-right text-muted-foreground">
      {value ?? "Unavailable"}
    </span>
  );
}

async function showLocation(action: () => CommandResult<void>) {
  const result = await action();
  if (Result.isFailure(result)) {
    toast.error(result.error.message);
  }
}

async function copyText(value: string, successMessage: string) {
  if (globalThis.navigator?.clipboard === undefined) {
    toast.error("Clipboard is unavailable");
    return;
  }

  const result = await Result.try({
    try: () => globalThis.navigator.clipboard.writeText(value),
    catch: (error) => error,
  });
  if (Result.isFailure(result)) {
    toast.error("Could not copy to clipboard");
    return;
  }

  toast.success(successMessage);
}

export function DiagnosticsSettingsScreen() {
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const isTauriBuild = import.meta.env.VITE_ZAI_BUILD_TARGET === "tauri";
  const appVersion = resolveAboutAppVersion(aboutPackageVersion());

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getDiagnostics();
    setLoading(false);

    if (Result.isFailure(result)) {
      toast.error(result.error.message);
      return;
    }

    setDiagnostics(result.value);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const initialLoading = loading && diagnostics === null;
  const database = diagnostics?.database;
  const logs = diagnostics?.logs;

  return (
    <ScreenBase contentClassName="pt-4">
      <div className="flex max-w-3xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SettingsSectionHeader title="Diagnostics" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={diagnostics === null}
              onClick={() => {
                if (diagnostics) {
                  void copyText(
                    buildDiagnosticsSummary(diagnostics, appVersion, isTauriBuild),
                    "Diagnostics copied",
                  );
                }
              }}
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
              Copy diagnostics
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void refresh()}
            >
              {loading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <SettingsSection title="System">
          <ItemGroup className="gap-0">
            <AboutSettingsRow title="App version">
              <DiagnosticValue loading={initialLoading} value={appVersion} />
            </AboutSettingsRow>
            <SettingsSectionDivider />
            <AboutSettingsRow title="Operating system">
              <DiagnosticValue
                loading={initialLoading}
                value={diagnostics ? formatOperatingSystem(diagnostics.operatingSystem) : undefined}
              />
            </AboutSettingsRow>
            <SettingsSectionDivider />
            <AboutSettingsRow title="Architecture">
              <DiagnosticValue loading={initialLoading} value={diagnostics?.architecture} />
            </AboutSettingsRow>
          </ItemGroup>
        </SettingsSection>

        <SettingsSection title="Database">
          <ItemGroup className="gap-0">
            <AboutSettingsRow title="Location" description={database?.path}>
              {initialLoading ? <Skeleton className="h-7 w-24" /> : null}
              {!initialLoading && database ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy database path"
                    title="Copy database path"
                    onClick={() => void copyText(database.path, "Database path copied")}
                  >
                    <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                  </Button>
                  {isTauriBuild ? (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Show database in folder"
                      onClick={() => void showLocation(showDatabaseInFolder)}
                    >
                      <HugeiconsIcon
                        icon={FolderOpenIcon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Show in folder
                    </Button>
                  ) : null}
                </>
              ) : null}
              {!initialLoading && !database ? <DiagnosticValue /> : null}
            </AboutSettingsRow>
            <SettingsSectionDivider />
            <AboutSettingsRow title="Storage used">
              <DiagnosticValue
                loading={initialLoading}
                value={database ? formatByteSize(database.sizeBytes) : undefined}
              />
            </AboutSettingsRow>
            <SettingsSectionDivider />
            <AboutSettingsRow title="Schema version">
              <DiagnosticValue loading={initialLoading} value={database?.schemaVersion} />
            </AboutSettingsRow>
          </ItemGroup>
        </SettingsSection>

        <SettingsSection title="Logs">
          <ItemGroup className="gap-0">
            {!initialLoading && !logs && !isTauriBuild ? (
              <AboutSettingsRow title="Persistent logs" value="Not configured" />
            ) : (
              <>
                <AboutSettingsRow title="Location" description={logs?.path}>
                  {initialLoading ? <Skeleton className="h-7 w-24" /> : null}
                  {!initialLoading && logs ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copy logs path"
                        title="Copy logs path"
                        onClick={() => void copyText(logs.path, "Logs path copied")}
                      >
                        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                      </Button>
                      {isTauriBuild ? (
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Show logs in folder"
                          onClick={() => void showLocation(showLogsInFolder)}
                        >
                          <HugeiconsIcon
                            icon={FolderOpenIcon}
                            strokeWidth={2}
                            data-icon="inline-start"
                          />
                          Show in folder
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {!initialLoading && !logs ? <DiagnosticValue /> : null}
                </AboutSettingsRow>
                <SettingsSectionDivider />
                <AboutSettingsRow title="Storage used">
                  <DiagnosticValue
                    loading={initialLoading}
                    value={logs ? formatByteSize(logs.sizeBytes) : undefined}
                  />
                </AboutSettingsRow>
              </>
            )}
          </ItemGroup>
        </SettingsSection>
      </div>
    </ScreenBase>
  );
}
