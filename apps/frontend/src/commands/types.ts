export type CommandArgs = Record<string, unknown>;

export interface CommandTransport {
  invoke: <T>(command: string, args?: CommandArgs) => Promise<T>;
}
