import { z } from "zod";

export const settingsSearchSchema = z.object({
  focus: z.enum(["rates", "currencies"]).optional().catch(undefined),
});

export type SettingsSearch = z.output<typeof settingsSearchSchema>;
