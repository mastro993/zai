export const PLACEHOLDER_APP_VERSION = "0.0.0-dev";
export const ABOUT_APP_IDENTIFIER = "dev.fedemas.zai.app";
export const ABOUT_LICENSE = "GPL-3.0-only";
export const ABOUT_TAURI_VERSION = "2.11.5";
export const UPDATE_CHECK_UNAVAILABLE_MESSAGE = "Update checks are not available yet.";

export type AboutReleaseChannel = "Beta" | "Stable";

export const resolveAboutAppVersion = (packageVersion: string): string =>
  packageVersion === PLACEHOLDER_APP_VERSION ? "dev" : packageVersion;

export const resolveAboutReleaseChannel = (packageVersion: string): AboutReleaseChannel | null => {
  if (/-beta\.\d+$/.test(packageVersion)) {
    return "Beta";
  }
  if (/^\d+\.\d+\.\d+$/.test(packageVersion)) {
    return "Stable";
  }
  return null;
};

export const resolveAboutBuildMode = (isProduction: boolean): "Production" | "Development" =>
  isProduction ? "Production" : "Development";

export const aboutPackageVersion = (): string =>
  import.meta.env.VITE_ZAI_APP_VERSION ?? PLACEHOLDER_APP_VERSION;
