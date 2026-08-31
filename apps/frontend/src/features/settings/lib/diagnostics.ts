import type { Diagnostics } from "../types/diagnostics";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export const formatByteSize = (bytes: number | null): string => {
  if (bytes === null) {
    return "Unavailable";
  }

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(value)} ${BYTE_UNITS[unitIndex]}`;
};

export const formatOperatingSystem = (operatingSystem: string): string => {
  switch (operatingSystem) {
    case "macos":
      return "macOS";
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    default:
      return operatingSystem;
  }
};

export const buildDiagnosticsSummary = (
  diagnostics: Diagnostics,
  appVersion: string,
  persistentLogsExpected: boolean,
): string =>
  [
    "Zai diagnostics",
    `App version: ${appVersion}`,
    `Operating system: ${formatOperatingSystem(diagnostics.operatingSystem)}`,
    `Architecture: ${diagnostics.architecture}`,
    "Database path: Available",
    `Database footprint: ${formatByteSize(diagnostics.database.sizeBytes)}`,
    `Schema version: ${diagnostics.database.schemaVersion ?? "Unavailable"}`,
    `Persistent logs: ${diagnostics.logs ? "Available" : persistentLogsExpected ? "Unavailable" : "Not configured"}`,
    `Log size: ${formatByteSize(diagnostics.logs?.sizeBytes ?? null)}`,
  ].join("\n");
