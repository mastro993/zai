import { Result } from "@praha/byethrow";

import {
  recurringProcessingEventSchema,
  type RecurringProcessingEvent,
} from "../types/recurring-processing-event";

export const parseRecurringProcessingEvent = (value: unknown): RecurringProcessingEvent | null => {
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

  const parsed = recurringProcessingEventSchema.safeParse(jsonResult.value);
  return parsed.success ? parsed.data : null;
};
