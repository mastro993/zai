import { z } from "zod";

export const currencySetupStateSchema = z.object({
  defaultCurrency: z.string(),
  setupCompleted: z.boolean(),
});

export type CurrencySetupState = z.infer<typeof currencySetupStateSchema>;
