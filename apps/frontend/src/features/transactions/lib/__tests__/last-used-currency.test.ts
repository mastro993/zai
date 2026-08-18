import { afterEach, describe, expect, it } from "vitest";

import {
  getLastUsedTransactionCurrency,
  resetLastUsedTransactionCurrency,
  setLastUsedTransactionCurrency,
} from "../last-used-currency";

describe("last-used transaction currency", () => {
  afterEach(() => {
    resetLastUsedTransactionCurrency();
  });

  it("starts empty and remembers the last saved currency for the session", () => {
    expect(getLastUsedTransactionCurrency()).toBeNull();
    setLastUsedTransactionCurrency("USD");
    expect(getLastUsedTransactionCurrency()).toBe("USD");
    setLastUsedTransactionCurrency("JPY");
    expect(getLastUsedTransactionCurrency()).toBe("JPY");
  });
});
