import { createCommandDescriptor } from "@/commands/command-descriptor";

import { currencySetupStateSchema } from "../types/setup";
import { buildCompleteInitialCurrencySetupRequest } from "./web-requests";

export const CURRENCY_COMMANDS = {
  complete_initial_currency_setup: createCommandDescriptor(
    "complete_initial_currency_setup",
    currencySetupStateSchema,
    buildCompleteInitialCurrencySetupRequest,
  ),
};

export const CURRENCY_BACKEND_COMMANDS = Object.values(CURRENCY_COMMANDS);
