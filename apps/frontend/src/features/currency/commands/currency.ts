import { invokeDecodedCommand } from "@/commands/shared";
import type { CommandResult } from "@/commands/shared";

import type { CurrencySetupState } from "../types/setup";
import { CURRENCY_COMMANDS } from "./registry";

export const completeInitialCurrencySetup = (
  defaultCurrency: string,
): CommandResult<CurrencySetupState> => {
  return invokeDecodedCommand(CURRENCY_COMMANDS.complete_initial_currency_setup, {
    defaultCurrency,
  });
};
