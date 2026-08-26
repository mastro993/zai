export const PLACEHOLDER_APP_VERSION = "0.0.0-dev";
export const ABOUT_APP_IDENTIFIER = "dev.fedemas.zai.app";
export const ABOUT_LICENSE = "GPL-3.0-only";
export const ABOUT_TAURI_VERSION = "2.11.5";

const packedVersionPattern = /^(\d{4})\.(\d+)\.(\d+)$/;

export const resolveAboutAppVersion = (packageVersion: string): string => {
  if (packageVersion === PLACEHOLDER_APP_VERSION) {
    return "dev";
  }

  const match = packedVersionPattern.exec(packageVersion);
  if (!match) {
    return packageVersion;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const patch = Number(match[3]);
  const day = Math.floor(patch / 1000);
  const build = patch % 1000;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return packageVersion;
  }

  return `${year}.${month}.${day}.${build}`;
};

export const resolveAboutBuildMode = (isProduction: boolean): "Production" | "Development" =>
  isProduction ? "Production" : "Development";

export const aboutPackageVersion = (): string =>
  import.meta.env.VITE_ZAI_APP_VERSION ?? PLACEHOLDER_APP_VERSION;
