export const ABOUT_APP_NAME = "Zai";
export const ABOUT_APP_VERSION = "0.0.1-alpha.1";
export const ABOUT_APP_IDENTIFIER = "dev.fedemas.zai.app";
export const ABOUT_LICENSE = "GPL-3.0-only";
export const ABOUT_TAURI_VERSION = "2.11.5";
export const ABOUT_RELEASE_CHANNEL = "Alpha";
export const UPDATE_CHECK_UNAVAILABLE_MESSAGE = "Update checks are not available yet.";

export const resolveAboutBuildMode = (isProduction: boolean): "Production" | "Development" =>
  isProduction ? "Production" : "Development";
