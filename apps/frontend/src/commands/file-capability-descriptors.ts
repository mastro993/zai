import type { CommandDescriptor } from "./command-descriptor";

export const FILE_CAPABILITY_DESKTOP_COMMANDS = [
  {
    name: "selectCsvImportFile",
    transport: "desktop-only",
    resultSchema: "void",
    webMapped: false,
  },
  {
    name: "downloadTextFile",
    transport: "desktop-only",
    resultSchema: "void",
    webMapped: false,
  },
] as const satisfies ReadonlyArray<CommandDescriptor>;
