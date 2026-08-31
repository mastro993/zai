import { createCommandDescriptor } from "@/commands/command-descriptor";

import { diagnosticsSchema } from "../types/diagnostics";
import { buildDesktopOnlyRequest, buildGetDiagnosticsRequest } from "./web-requests";

export const DIAGNOSTICS_COMMANDS = {
  get_diagnostics: createCommandDescriptor(
    "get_diagnostics",
    diagnosticsSchema,
    buildGetDiagnosticsRequest,
  ),
  show_database_in_folder: createCommandDescriptor(
    "show_database_in_folder",
    "void",
    buildDesktopOnlyRequest,
  ),
  show_logs_in_folder: createCommandDescriptor(
    "show_logs_in_folder",
    "void",
    buildDesktopOnlyRequest,
  ),
};

export const DIAGNOSTICS_BACKEND_COMMANDS = Object.values(DIAGNOSTICS_COMMANDS);
