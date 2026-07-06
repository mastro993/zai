import { R, type Result } from "@praha/byethrow";

type CommandArgs = Record<string, unknown>;

export type CommandResult<T> = Result.ResultAsync<T, Error>;

const toCommandError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
};

export const invokeCommand = <T>(command: string, args?: CommandArgs): CommandResult<T> => {
  if (typeof window === "undefined") {
    return Promise.resolve(R.fail(new Error("Desktop commands are only available in the client")));
  }

  return R.try({
    try: () => import("@tauri-apps/api/core").then(({ invoke }) => invoke<T>(command, args)),
    catch: toCommandError,
  });
};
