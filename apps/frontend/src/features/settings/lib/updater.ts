import { Result } from "@praha/byethrow";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { warn } from "@tauri-apps/plugin-log";

import { toast } from "@/components/toaster/toast";

import { PLACEHOLDER_APP_VERSION, aboutPackageVersion, resolveAboutAppVersion } from "./about-info";

export const UPDATE_CHANNEL_STORAGE_KEY = "zai-update-channel";
export const DEFAULT_UPDATE_CHANNEL = "stable" as const;
export const UPDATE_CHECK_TIMEOUT_MS = 30_000;

export type UpdateChannel = "stable" | "nightly";
export type UpdaterTarget = "macos-aarch64" | "macos-x86_64" | "linux-x86_64" | "windows-x86_64";

export interface UpdateChannelStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface UpdateProgress {
  phase: "downloading" | "installing";
  percent?: number;
}

export type UpdateCheckStatus = "busy" | "current" | "declined" | "restarting";

export class UpdaterError extends Error {
  override readonly name = "UpdaterError";

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

const updaterFailure =
  (message: string) =>
  (cause: unknown): UpdaterError =>
    new UpdaterError(message, cause);

export const isUpdateChannel = (value: string | null): value is UpdateChannel =>
  value === "stable" || value === "nightly";

export const isUpdaterTarget = (value: string | undefined): value is UpdaterTarget =>
  value === "macos-aarch64" ||
  value === "macos-x86_64" ||
  value === "linux-x86_64" ||
  value === "windows-x86_64";

const defaultStorage = (): UpdateChannelStorage | null => {
  const result = Result.try({
    try: () => window.localStorage,
    catch: () => null,
  });

  return Result.isSuccess(result) ? result.value : null;
};

export const readUpdateChannel = (storage?: UpdateChannelStorage): UpdateChannel => {
  const resolvedStorage = storage ?? defaultStorage();
  if (!resolvedStorage) {
    return DEFAULT_UPDATE_CHANNEL;
  }

  const result = Result.try({
    try: () => resolvedStorage.getItem(UPDATE_CHANNEL_STORAGE_KEY),
    catch: () => null,
  });

  return Result.isSuccess(result) && isUpdateChannel(result.value)
    ? result.value
    : DEFAULT_UPDATE_CHANNEL;
};

export const writeUpdateChannel = (
  channel: UpdateChannel,
  storage?: UpdateChannelStorage,
): boolean => {
  const resolvedStorage = storage ?? defaultStorage();
  if (!resolvedStorage) {
    return false;
  }

  const result = Result.try({
    try: () => resolvedStorage.setItem(UPDATE_CHANNEL_STORAGE_KEY, channel),
    catch: () => undefined,
  });

  return Result.isSuccess(result);
};

export const updaterManifestTarget = (channel: UpdateChannel, target: UpdaterTarget): string =>
  `${channel}-${target}`;

export const isUpdaterAvailable = (
  buildTarget: string | undefined,
  packageVersion: string,
  updaterTarget: string | undefined,
): boolean =>
  buildTarget === "tauri" &&
  packageVersion !== PLACEHOLDER_APP_VERSION &&
  isUpdaterTarget(updaterTarget);

const closeUpdate = async (update: Update): Result.ResultAsync<void, UpdaterError> =>
  Result.try({
    try: () => update.close(),
    catch: updaterFailure("Update session could not be closed."),
  });

const checkForUpdatesCore = async (
  channel: UpdateChannel,
  target: UpdaterTarget,
  onProgress?: (progress: UpdateProgress) => void,
): Result.ResultAsync<UpdateCheckStatus, UpdaterError> => {
  const checkResult = await Result.try({
    try: async () => {
      const { check } = await import("@tauri-apps/plugin-updater");
      return check({
        target: updaterManifestTarget(channel, target),
        timeout: UPDATE_CHECK_TIMEOUT_MS,
      });
    },
    catch: updaterFailure("Update check failed."),
  });
  if (Result.isFailure(checkResult)) {
    return checkResult;
  }

  const update = checkResult.value;
  if (!update) {
    return Result.succeed("current");
  }

  const confirmationResult = await Result.try({
    try: async () => {
      const { confirm } = await import("@tauri-apps/plugin-dialog");
      return confirm(
        `Zai ${resolveAboutAppVersion(update.version)} is available. Zai will restart after installation.`,
        {
          title: "Update Zai",
          kind: "info",
          okLabel: "Update and restart",
          cancelLabel: "Later",
        },
      );
    },
    catch: updaterFailure("Update confirmation failed."),
  });
  if (Result.isFailure(confirmationResult)) {
    return confirmationResult;
  }
  if (!confirmationResult.value) {
    const closeResult = await closeUpdate(update);
    return Result.isFailure(closeResult) ? closeResult : Result.succeed("declined");
  }

  let downloaded = 0;
  let contentLength: number | undefined;
  const downloadResult = await Result.try({
    try: () =>
      update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
          onProgress?.({ phase: "downloading", percent: contentLength ? 0 : undefined });
          return;
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          onProgress?.({
            phase: "downloading",
            percent: contentLength
              ? Math.min(100, Math.floor((downloaded / contentLength) * 100))
              : undefined,
          });
          return;
        }
        onProgress?.({ phase: "installing", percent: 100 });
      }),
    catch: updaterFailure("Update download or installation failed."),
  });
  if (Result.isFailure(downloadResult)) {
    return downloadResult;
  }

  const relaunchResult = await Result.try({
    try: async () => {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
    catch: updaterFailure("Update installed, but Zai could not restart."),
  });

  return Result.isFailure(relaunchResult) ? relaunchResult : Result.succeed("restarting");
};

// ponytail: one app-wide update task; add shared progress subscriptions only if overlap matters.
let updateCheckRunning = false;

export const checkForUpdates = async (
  channel: UpdateChannel,
  target: UpdaterTarget,
  onProgress?: (progress: UpdateProgress) => void,
): Result.ResultAsync<UpdateCheckStatus, UpdaterError> => {
  if (updateCheckRunning) {
    return Result.succeed("busy");
  }

  updateCheckRunning = true;
  const result = await checkForUpdatesCore(channel, target, onProgress);
  updateCheckRunning = false;
  return result;
};

const logAutomaticUpdateFailure = async (error: UpdaterError): Promise<void> => {
  const result = await Result.try({
    try: () => warn(error.message),
    catch: () => undefined,
  });
  void result;
};

export const startAutomaticUpdateCheck = (): void => {
  const buildTarget = import.meta.env.VITE_ZAI_BUILD_TARGET;
  const packageVersion = aboutPackageVersion();
  const target = import.meta.env.VITE_ZAI_UPDATER_TARGET;
  if (!isUpdaterAvailable(buildTarget, packageVersion, target) || !isUpdaterTarget(target)) {
    return;
  }

  void (async () => {
    let toastId: number | string | undefined;
    const result = await checkForUpdates(readUpdateChannel(), target, (progress) => {
      const message =
        progress.phase === "installing"
          ? "Installing update…"
          : progress.percent === undefined
            ? "Downloading update…"
            : `Downloading update… ${progress.percent}%`;
      toastId = toast.loading(message, toastId === undefined ? undefined : { id: toastId });
    });

    if (Result.isFailure(result)) {
      if (toastId !== undefined) {
        toast.error(result.error.message, { id: toastId });
      }
      await logAutomaticUpdateFailure(result.error);
    }
  })();
};
