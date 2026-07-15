import type { CommandDescriptor } from "./command-descriptor";
import { ALERT_BACKEND_COMMANDS } from "@/features/alerts/commands/registry";
import { CASH_FLOW_BACKEND_COMMANDS } from "@/features/cash-flow/commands/registry";

export type { CommandDescriptor, CommandTransportClass } from "./command-descriptor";
export { decodeCommandValue, invokeDecodedCommand } from "./decode-command-result";

export const BACKEND_COMMAND_REGISTRY = [
  ...CASH_FLOW_BACKEND_COMMANDS,
  ...ALERT_BACKEND_COMMANDS,
] as const satisfies ReadonlyArray<CommandDescriptor>;

export const BACKEND_COMMAND_NAMES = BACKEND_COMMAND_REGISTRY.map((descriptor) => descriptor.name);

export const WEB_MAPPED_BACKEND_COMMAND_NAMES = BACKEND_COMMAND_REGISTRY.filter(
  (descriptor) => descriptor.webMapped,
).map((descriptor) => descriptor.name);

export const commandDescriptorByName = (name: string): CommandDescriptor | undefined =>
  BACKEND_COMMAND_REGISTRY.find((descriptor) => descriptor.name === name);
