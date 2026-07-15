import type { z } from "zod";

export type CommandTransportClass = "backend" | "desktop-only";

export interface CommandDescriptor<T = unknown> {
  readonly name: string;
  readonly transport: CommandTransportClass;
  readonly resultSchema: z.ZodType<T> | "void";
  readonly webMapped: boolean;
}
