import { CommandError } from "./errors";
import type { CommandTransport } from "./types";

export const createWebCommandTransport = (): CommandTransport => ({
  invoke: () => Promise.reject(new CommandError("Web command transport is not implemented yet")),
});
