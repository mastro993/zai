import type { CommandDescriptor } from "./command-descriptor";
import { ALERT_BACKEND_COMMANDS } from "@/features/alerts/commands/registry";
import { BUDGET_BACKEND_COMMANDS } from "@/features/budgets/commands/registry";
import { CATEGORY_BACKEND_COMMANDS } from "@/features/categories/commands/registry";
import { TRANSACTION_BACKEND_COMMANDS } from "@/features/transactions/commands/registry";

export type { CommandDescriptor, CommandTransportClass } from "./command-descriptor";
export { decodeCommandValue } from "./decode-command-result";
export { FILE_CAPABILITY_DESKTOP_COMMANDS } from "./file-capability-descriptors";
export { invokeDecodedCommand } from "./shared";

export const BACKEND_COMMAND_REGISTRY = [
  ...BUDGET_BACKEND_COMMANDS,
  ...CATEGORY_BACKEND_COMMANDS,
  ...TRANSACTION_BACKEND_COMMANDS,
  ...ALERT_BACKEND_COMMANDS,
] as const satisfies ReadonlyArray<CommandDescriptor>;

export const BACKEND_COMMAND_NAMES = BACKEND_COMMAND_REGISTRY.map((descriptor) => descriptor.name);

export const WEB_MAPPED_BACKEND_COMMAND_NAMES = BACKEND_COMMAND_REGISTRY.filter(
  (descriptor) => descriptor.webMapped,
).map((descriptor) => descriptor.name);

export const commandDescriptorByName = (name: string): CommandDescriptor | undefined =>
  BACKEND_COMMAND_REGISTRY.find((descriptor) => descriptor.name === name);
