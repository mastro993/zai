import { Result } from "@praha/byethrow";
import { z } from "zod";

import { asWireString } from "@/lib/wire";

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

export const parseDomainAlertEvent = <TRaw>(value: TRaw): DomainAlertEvent | null => {
  const encoded = asWireString(value);
  if (encoded !== undefined) {
    const jsonResult = Result.try({
      try: () => domainAlertEventSchema.safeParse(JSON.parse(encoded)),
      catch: () => domainAlertEventSchema.safeParse(null),
    });
    if (Result.isFailure(jsonResult) || !jsonResult.value.success) {
      return null;
    }
    return jsonResult.value.data;
  }

  const parsed = domainAlertEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
