import { Result } from "@praha/byethrow";

import { asWireString } from "@/lib/wire";

import {
  recurringProcessingEventSchema,
  type RecurringProcessingEvent,
} from "../types/recurring-processing-event";

export const parseRecurringProcessingEvent = <TRaw>(
  value: TRaw,
): RecurringProcessingEvent | null => {
  const encoded = asWireString(value);
  if (encoded !== undefined) {
    const jsonResult = Result.try({
      try: () => recurringProcessingEventSchema.safeParse(JSON.parse(encoded)),
      catch: () => recurringProcessingEventSchema.safeParse(null),
    });
    if (Result.isFailure(jsonResult) || !jsonResult.value.success) {
      return null;
    }
    return jsonResult.value.data;
  }

  const parsed = recurringProcessingEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
