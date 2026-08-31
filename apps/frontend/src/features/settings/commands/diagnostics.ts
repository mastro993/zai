import { invokeDecodedCommand, type CommandResult } from "@/commands/shared";

import type { Diagnostics } from "../types/diagnostics";
import { DIAGNOSTICS_COMMANDS } from "./registry";

export const getDiagnostics = (): CommandResult<Diagnostics> =>
  invokeDecodedCommand(DIAGNOSTICS_COMMANDS.get_diagnostics);

export const showDatabaseInFolder = (): CommandResult<void> =>
  invokeDecodedCommand(DIAGNOSTICS_COMMANDS.show_database_in_folder);

export const showLogsInFolder = (): CommandResult<void> =>
  invokeDecodedCommand(DIAGNOSTICS_COMMANDS.show_logs_in_folder);
