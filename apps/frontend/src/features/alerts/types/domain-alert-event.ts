import { Result } from "@praha/byethrow";
import { z } from "zod";

import { domainAlertSchema } from "./domain-alert";

export const DOMAIN_ALERT_EVENT_VERSION = 1 as const;
export const DOMAIN_ALERT_EVENT_NAME = "domain-alert";

const createdDomainAlertEventSchema = z.strictObject({
  version: z.literal(DOMAIN_ALERT_EVENT_VERSION),
  type: z.literal("created"),
  alert: domainAlertSchema,
});

const stateChangedDomainAlertEventSchema = z.strictObject({
  version: z.literal(DOMAIN_ALERT_EVENT_VERSION),
  type: z.literal("stateChanged"),
});

export const domainAlertEventSchema = z.discriminatedUnion("type", [
  createdDomainAlertEventSchema,
  stateChangedDomainAlertEventSchema,
]);

export type DomainAlertEvent = z.infer<typeof domainAlertEventSchema>;

export const parseDomainAlertEvent = (value: unknown): DomainAlertEvent | null => {
  const jsonResult =
    typeof value === "string"
      ? Result.try({
          try: () => JSON.parse(value) as unknown,
          catch: () => null,
        })
      : Result.succeed(value);

  if (Result.isFailure(jsonResult)) {
    return null;
  }

  const parsed = domainAlertEventSchema.safeParse(jsonResult.value);
  return parsed.success ? parsed.data : null;
};
