import { z } from "zod";
import { zu } from "zod_utilz";

export const AccessTokenSchema = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
});

export const AccessTokenSchemaFromString = zu
  .stringToJSON()
  .pipe(AccessTokenSchema);

export type AccessToken = z.infer<typeof AccessTokenSchema>;

export const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  bic: z.string(),
  transaction_total_days: z.string(),
  max_access_valid_for_days: z.string(),
  countries: z.array(z.string()),
  logo: z.string(),
});

export const IntegrationArraySchema = z.array(IntegrationSchema);

export const IntegrationArraySchemaFromString = zu
  .stringToJSON()
  .pipe(IntegrationArraySchema);

export type Integration = z.infer<typeof IntegrationSchema>;
export type IntegrationArray = z.infer<typeof IntegrationArraySchema>;
