import { Result } from "@praha/byethrow";

import { CommandError } from "@/commands/errors";
import type { WebRequestSpec } from "@/commands/web-request-spec";

export const buildGetDiagnosticsRequest = (
  _args: void,
): Result.Result<WebRequestSpec, CommandError> =>
  Result.succeed({ method: "GET", path: "/diagnostics" });

export const buildDesktopOnlyRequest = (_args: void): Result.Result<WebRequestSpec, CommandError> =>
  Result.fail(new CommandError("Folder actions are available in the desktop app only"));
