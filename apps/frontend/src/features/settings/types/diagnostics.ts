import { z } from "zod";

const locationDiagnosticsSchema = z.object({
  path: z.string(),
  sizeBytes: z.number().int().nonnegative().nullable(),
});

export const diagnosticsSchema = z.object({
  operatingSystem: z.string(),
  architecture: z.string(),
  database: locationDiagnosticsSchema.extend({
    schemaVersion: z.string().nullable(),
  }),
  logs: locationDiagnosticsSchema.nullable(),
});

export type Diagnostics = z.infer<typeof diagnosticsSchema>;
