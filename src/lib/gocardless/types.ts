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
