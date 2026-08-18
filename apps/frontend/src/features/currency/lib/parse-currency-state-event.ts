import { Result } from "@praha/byethrow";

import { asWireString } from "@/lib/wire";

import { currencyStateEventSchema, type CurrencyStateEvent } from "../types/currency-state-event";

export const parseCurrencyStateEvent = <TRaw>(value: TRaw): CurrencyStateEvent | null => {
  const encoded = asWireString(value);
  if (encoded !== undefined) {
    const jsonResult = Result.try({
      try: () => currencyStateEventSchema.safeParse(JSON.parse(encoded)),
      catch: () => currencyStateEventSchema.safeParse(null),
    });
    if (Result.isFailure(jsonResult) || !jsonResult.value.success) {
      return null;
    }
    return jsonResult.value.data;
  }

  const parsed = currencyStateEventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};
