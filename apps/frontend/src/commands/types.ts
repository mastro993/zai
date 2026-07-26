import type { CommandDescriptor } from "./command-descriptor";

export interface CommandTransport {
  invoke: <TArgs, TResult>(
    descriptor: CommandDescriptor<TArgs, TResult>,
    args: TArgs,
  ) => Promise<TResult>;
}
