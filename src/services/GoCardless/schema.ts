import { z } from "zod";

export const GoCardlessAccessToken = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
});

export type GoCardlessAccessToken = z.infer<typeof GoCardlessAccessToken>;
