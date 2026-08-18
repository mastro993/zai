import { createCommandDescriptor } from "@/commands/command-descriptor";

import {
  currencyBootstrapSchema,
  currencyJobSchema,
  currencySettingsRowSchema,
  currencyStatusViewSchema,
  supportedCurrencySchema,
} from "../types/currency";
import {
  buildCompleteInitialCurrencySetupRequest,
  buildGetCurrenciesRequest,
  buildGetCurrencyBootstrapRequest,
  buildGetCurrencyJobRequest,
  buildGetCurrencyRequest,
  buildGetCurrencyStatusRequest,
  buildGetSupportedCurrenciesRequest,
} from "./web-requests";

export const CURRENCY_COMMANDS = {
  get_currency_bootstrap: createCommandDescriptor(
    "get_currency_bootstrap",
    currencyBootstrapSchema,
    buildGetCurrencyBootstrapRequest,
  ),
  get_currencies: createCommandDescriptor(
    "get_currencies",
    currencySettingsRowSchema.array(),
    buildGetCurrenciesRequest,
  ),
  get_supported_currencies: createCommandDescriptor(
    "get_supported_currencies",
    supportedCurrencySchema.array(),
    buildGetSupportedCurrenciesRequest,
  ),
  get_currency: createCommandDescriptor(
    "get_currency",
    currencySettingsRowSchema,
    buildGetCurrencyRequest,
  ),
  complete_initial_currency_setup: createCommandDescriptor(
    "complete_initial_currency_setup",
    currencyJobSchema,
    buildCompleteInitialCurrencySetupRequest,
  ),
  get_currency_job: createCommandDescriptor(
    "get_currency_job",
    currencyJobSchema,
    buildGetCurrencyJobRequest,
  ),
  get_currency_status: createCommandDescriptor(
    "get_currency_status",
    currencyStatusViewSchema,
    buildGetCurrencyStatusRequest,
  ),
};

export const CURRENCY_BACKEND_COMMANDS = Object.values(CURRENCY_COMMANDS);
